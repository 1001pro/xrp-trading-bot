import * as xrpl from 'xrpl';
import { Client, Wallet, TransactionMetadataBase } from 'xrpl';
import { BASE_RESERVE, bot, CLIENT, OWNER_RESERVE } from '../config/config';
import { buySuccessText, sellSuccessText } from '../models/text.model';
import { User, UserType } from '../models/user.model';
import { roundToSpecificDecimal } from './functions';

export async function generateWallet() {
  return Wallet.generate();
}

export function generateWalletFromSeed(seed: string) {
  try {
    return Wallet.fromSeed(seed);
  } catch (error) {
    throw new Error('Invalid seed. Please check and then try again.');
  }
}

export async function sellToken(currency: string, issuer: string, name: string, sellamount: string, seed: string, user: UserType, price: number) {
  bot.telegram.sendMessage(user.tgId, 'Transaction is pending...');
  if (!CLIENT.isConnected) {
    await CLIENT.connect();
  }

  const wallet = Wallet.fromSeed(seed);

  const paymentTransaction: xrpl.SubmittableTransaction = {
    TransactionType: 'OfferCreate',
    Account: wallet.address,
    TakerGets: {
      currency: currency,
      issuer: issuer,
      value: sellamount,
    },
    TakerPays: xrpl.xrpToDrops('0.000001'),
    Flags: xrpl.OfferCreateFlags.tfImmediateOrCancel | xrpl.OfferCreateFlags.tfSell,
    Fee: '12',
    LastLedgerSequence: (await CLIENT.getLedgerIndex()) + 5,
  };

  try {
    const prepared = await CLIENT.autofill(paymentTransaction);
    const signed = wallet.sign(prepared);
    const result = await CLIENT.submitAndWait(signed.tx_blob);

    if (typeof result.result.meta === 'string') {
      console.log('type of result.result.meta is string: ', result.result);
      return false;
    }

    // If transaction failed
    if (result.result.meta?.TransactionResult !== 'tesSUCCESS') {
      console.log('Failed', result.result);
      return false;
    }

    const { xrp, other } = getBalanceChangesFromMeta(result.result.meta as TransactionMetadataBase, wallet.address);

    const address = currency + '.' + issuer;

    await transferReferralFee(user, xrp);

    await user.save();

    bot.telegram.sendMessage(user.tgId, await sellSuccessText(address, name, xrp, other, signed.hash, price), {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    });
    return true;
  } catch (error) {
    console.error('Error setting trustline:', error);
    return false;
  }
}

export async function buyToken(currency: string, issuer: string, name: string, amount: string, seed: string, user: UserType, price: number) {
  try {
    bot.telegram.sendMessage(user.tgId, 'Transaction is pending...');

    if (!CLIENT.isConnected) {
      await CLIENT.connect();
    }

    const wallet = Wallet.fromSeed(seed); // For real net

    // Send OfferCreate transaction
    const offerCreate: xrpl.SubmittableTransaction = {
      TransactionType: 'OfferCreate',
      Account: wallet.address,
      TakerPays: {
        currency: currency,
        issuer: issuer,
        value: '0.0001',
      },
      TakerGets: xrpl.xrpToDrops(roundToSpecificDecimal(Number(amount), 6)),
      Flags: xrpl.OfferCreateFlags.tfImmediateOrCancel | xrpl.OfferCreateFlags.tfSell,
      Fee: '100',
      LastLedgerSequence: (await CLIENT.getLedgerIndex()) + 5,
    };

    const prepared = await CLIENT.autofill(offerCreate);
    const signed = wallet.sign(prepared);
    const result = await CLIENT.submitAndWait(signed.tx_blob);

    if (typeof result.result.meta === 'string') {
      console.log('type of result.result.meta is string: ', result.result);
      return false;
    }

    // If transaction failed
    if (result.result.meta?.TransactionResult !== 'tesSUCCESS') {
      console.log('transaction is failed', result.result);
      return false;
    }

    await transferReferralFee(user, Number(amount));

    // Check balances, summarize all the balance changes caused by a transaction.
    const { xrp, other } = getBalanceChangesFromMeta(result.result.meta, wallet.address);
    const address = currency + '.' + issuer;

    // const { price, priceUsd } = await getTokenDetails('xrp');

    bot.telegram.sendMessage(user.tgId, await buySuccessText(address, name, xrp, other, signed.hash, price), {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    });
    return true
  } catch (error) {
    console.error(error);
    return false
  }
}

export async function getSpecificTokenBalance(address: string, currency: string, issuer: string) {
  if (!CLIENT.isConnected) {
    await CLIENT.connect();
  }

  const request: xrpl.Request = {
    command: 'account_lines',
    account: address,
    peer: issuer,
    currency: currency,
  };

  const response = await CLIENT.request(request);
  const balance = response.result.lines.find((line) => line.currency === currency && line.account === issuer)?.balance || '0';

  return balance;
}

function getBalanceChangesFromMeta(meta: TransactionMetadataBase, address: string) {
  const balance_changes = xrpl.getBalanceChanges(meta);

  const balance_change = balance_changes.find((bc) => bc.account === address);
  return {
    xrp: Math.abs(Number(balance_change?.balances.find((b) => b.currency === 'XRP')?.value || '0')),
    other: Math.abs(Number(balance_change?.balances.find((b) => b.currency !== 'XRP')?.value || '0')),
  };
}

export async function isValidToken(token: string) {
  const tokens = token.split('.');
  if (tokens.length !== 2) {
    return false;
  }

  const issuedCurrencies = await CLIENT.request({
    command: 'account_currencies',
    account: tokens[1],
  });

  if (issuedCurrencies.result.send_currencies.includes(tokens[0])) {
    return true;
  }

  return false;
}

export async function getBalanceOfWallet(walletAddress: string) {
  try {
    if (!CLIENT.isConnected) {
      await CLIENT.connect();
    }

    const balance = await CLIENT.getXrpBalance(walletAddress);
    return balance;
  } catch (error: any) {
    return 0;
    // throw new Error(error.message || 'Unexpected error while fetching balance of wallet');
  }
}

export async function getAvailableBalanceOfWallet(walletAddress: string) {
  try {
    if (!CLIENT.isConnected) {
      await CLIENT.connect();
    }

    const balance = await CLIENT.getXrpBalance(walletAddress);

    const lenOfTrusts = (await getAllTrustlines(walletAddress)).length;
    return balance - BASE_RESERVE - OWNER_RESERVE * lenOfTrusts;
  } catch (error: any) {
    return 0;
    // throw new Error(error.message || 'Unexpected error while fetching balance of wallet');
  }
}

export async function getTokenDetails(address: string) {
  try {
    const response = await fetch(`${process.env.DEX_SCREENER_ENDPOINT}/tokens/v1/xrpl/${address}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const datas = await response.json();
    const data = datas.find((d: any) => d.quoteToken.address === 'XRP');

    return {
      price: data.priceNative,
      priceUsd: data.priceUsd,
      issuer: data.baseToken.address.split('.')[1],
      address: data.baseToken.address,
      name: data.baseToken.name,
      marketCap: data.marketcap,
      liquidity: data.liquidity.usd,
    };
  } catch (error: any) {
    console.error(error);
    throw new Error(error.message || 'Unexpected error while fetching token details');
  }
}

export async function tokenTransfer(wallet: Wallet, destination: string, amount: string) {
  try {
    if (!CLIENT.isConnected) {
      await CLIENT.connect();
    }

    const prepared = await CLIENT.autofill({
      TransactionType: 'Payment',
      Account: wallet.address,
      Amount: xrpl.xrpToDrops(amount),
      Destination: destination,
      LastLedgerSequence: (await CLIENT.getLedgerIndex()) + 5,
    });

    const signed = wallet.sign(prepared);
    const tx = await CLIENT.submitAndWait(signed.tx_blob);

    if (typeof tx.result.meta === 'string') {
      console.log('type of result.result.meta is string: ', tx.result);
      throw new Error('Transaction is failed.');
    }

    // If transaction failed
    if (tx.result.meta?.TransactionResult !== 'tesSUCCESS') {
      if (tx.result.meta?.TransactionResult === 'The transaction failed because the sending account is trying to send more XRP than it holds, not counting the reserve.') {
        throw new Error('Insufficient balance for transferring XRP.');
      } else if (tx.result.meta?.TransactionResult === 'tecNO_DST_INSUF_XRP') {
        throw new Error('The account on the receiving end of the transaction does not exist, and the transaction is not sending enough XRP to create it.');
      }
      throw new Error('Transaction is failed.');
    }
    return signed.hash;
  } catch (error: any) {
    console.error(error);
    throw new Error(error.message || 'Unexpected error while transferring token.');
  }
}

export function isValidXRPAddress(address: string): boolean {
  // Ripple alphabet
  const rippleAlphabet = 'rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz';

  // Check length
  if (address.length < 25 || address.length > 35) {
    return false;
  }

  // Check if all characters are in the Ripple alphabet
  for (const char of address) {
    if (!rippleAlphabet.includes(char)) {
      return false;
    }
  }

  // Validate checksum (last 4 characters)
  const base58 = require('base-x')(rippleAlphabet);
  try {
    const decoded = base58.decode(address);
    return decoded.length === 25; // Valid XRP addresses decode to 25 bytes
  } catch (e) {
    return false;
  }
}

export async function transferReferralFee(user: UserType, profit: number) {
  try {
    if (user.wallet.address === (process.env.ADMIN_ADDRESS || '')) {
      return;
    }

    let cycle = 3;
    let tempUser = user;
    const wallet = generateWalletFromSeed(user.wallet.seed);
    while (cycle > 0) {
      const parent = await User.findOne({ tgId: tempUser.parent });
      if (!parent) {
        cycle = 0;
      } else if (wallet.address === parent.wallet.address) {
        tempUser = parent;
        cycle--;
      } else {
        await tokenTransfer(wallet, parent.wallet.address, roundToSpecificDecimal(profit * cycle * 0.001, 6).toString());

        parent.referralEarns += profit * cycle * 0.001;
        await parent.save();

        tempUser = parent;
        cycle--;
      }
    }

    // const admin = await User.findOne({ isAdmin: true });
    const admin = process.env.ADMIN_ADDRESS || '';
    if (!admin) return;
    await tokenTransfer(wallet, admin, roundToSpecificDecimal(profit * 0.01, 6).toString());
  } catch (error: any) {
    throw new Error(error.message || 'Unexpected error while transfering referral fee.');
  }
}

export async function getTokensDetails(addresses: string) {
  try {
    const response = await fetch(`${process.env.DEX_SCREENER_ENDPOINT}/tokens/v1/xrpl/${addresses}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const datas = await response.json();
    const pairedWithXRP = datas.filter((d: any) => d.quoteToken.address === 'XRP');

    const tokens: {
      price: any;
      priceUsd: any;
      issuer: any;
      address: any;
      name: any;
      liquidity: any;
    }[] = [];

    pairedWithXRP.map((p: any) => {
      tokens.push({
        price: p.priceNative,
        priceUsd: p.priceUsd,
        issuer: p.baseToken.address.split('.')[1],
        address: p.baseToken.address,
        name: p.baseToken.name,
        liquidity: p.liquidity.usd,
      });
    });

    return tokens;
  } catch (error: any) {
    console.error(error);
    throw new Error(error.message || 'Unexpected error while fetching token details');
  }
}

export async function getAllTokens(address: string) {
  try {
    if (!CLIENT.isConnected) {
      await CLIENT.connect();
    }

    const result = await CLIENT.request({
      command: 'account_lines',
      account: address,
    });

    const tokens: { address: string; balance: number; name: string }[] = [];
    const addresses: string[] = [];
    result.result.lines.map((l) => {
      const bal = roundToSpecificDecimal(Number(l.balance), 6);
      if (bal <= 0) return;
      addresses.push(l.currency + '.' + l.account);
      tokens.push({
        address: l.currency + '.' + l.account,
        balance: bal,
        name: '',
      });
    });

    const returndata = await getTokensDetails(addresses.join(','));

    returndata.map((r) => {
      const t = tokens.find((to) => to.address === r.address);
      if (!t) return;
      t.name = r.name;
    });

    return tokens;
  } catch (error: any) {
    console.error(error);
    throw new Error(error.message || `Unexpected error while fetching all tokens from walllet ${address}`);
  }
}

export async function getAllTrustlines(address: string) {
  if (!CLIENT.isConnected) {
    await CLIENT.connect();
  }

  const account_lines = await CLIENT.request({
    command: 'account_lines',
    account: address,
    ledger_index: 'validated',
  });

  return account_lines.result.lines;
}
