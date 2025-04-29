import { Order, UserType } from './user.model';
import { roundToSpecificDecimal } from '../utils/functions';
import { getAllTokens, getAllTrustlines, getBalanceOfWallet, getSpecificTokenBalance, getTokenDetails } from '../utils/xrpl';
import { BASE_RESERVE, OWNER_RESERVE } from '../config/config';

/**
 * The text when start command is inputed
 */
export const startText = async (user: UserType) => {
  let balance = 0;
  let avlbbalance = 0;
  let balanceUsd = 0;
  let lines = [];
  if (user.wallet.address) {
    lines = await getAllTrustlines(user.wallet.address);
    balance = await getBalanceOfWallet(user.wallet.address);
    const { price, priceUsd } = await getTokenDetails('xrp');
    balanceUsd = (balance * priceUsd) / price;
    avlbbalance = roundToSpecificDecimal(balance - BASE_RESERVE - lines.length * OWNER_RESERVE, 6);
    avlbbalance = avlbbalance > 0 ? avlbbalance : 0;
  }

  return (
    `🎉 @${user?.username}, <b>Welcome to Referral Fee Bot</b>\n\n` +
    `<b>Wallet Reserves</b>\n` +
    `Wallet activation reserve is currently 1 XRP.\n` +
    `The XRP Ledger applies reserve requirements, in XRP, to protect the shared global ledger from growing excessively large as the result of spam or malicious usage.\n` +
    `The current reserve requirements on Mainnet are:\n` +
    `Base reserve: ${BASE_RESERVE} XRP\n` +
    `Owner reserve:${OWNER_RESERVE} XRP per item\n\n` +
    `Wallet address: <code>${user.wallet.address ? user.wallet.address : 'You have no wallet.'}</code>\n` +
    `Wallet balance: ${balance} XRP($${roundToSpecificDecimal(balanceUsd, 2)})\n` +
    `Available: ${avlbbalance} XRP($${roundToSpecificDecimal((avlbbalance * balanceUsd) / balance, 2)})\n\n` +
    `🔗 Referral link: https://t.me/xrp_auto_bot?start=${user.referralCode}` +
    `${user.parent ? `` : ''}\n\n` +
    `✔️Send contract address to start trading.`
  );
};

/**
 * The text to be sent when new user login
 * @param {} user
 */
export const newUserText = async (user: UserType) => {
  const balance = await getBalanceOfWallet(user.wallet.address);
  // const price = await get
  try {
    return (
      `👋 Hello, <b>@${user?.username}</b>\n\n` +
      `⚠ Keep your <i>seed</i> <b>safe</b>\n` +
      `💳 Address: <code>${user.wallet.address}</code>\n` +
      `🔑 Seed: <code>${user.wallet.seed}</code>\n\n` +
      `💰 Wallet balance: ${balance} XRP`
    );
  } catch (error) {
    console.error('Error while getting newUserText:', error);
    throw new Error('Failed to create newUser text.');
  }
};

/**
 * The text when help command is inputed
 */
export const helpText = `⭐️ What are the trading fees?
A 1% admin fee is charged for both buying and selling. For example, if you buy/sell 1 XRP, the trading fee is 0.01 XRP
Referral rewards up to 3 levels - 30%/20%/10%.

⭐️ How to withdraw XRP from the wallet?
Send /start, click 'Withdraw' button, enter the withdrawal address and amount.

⭐️ How to check referral earnings?
Send /referral to view your unique referral link and earnings.`;

// export const helpText =
//   `🚀 <b>Smart 🦊 XRP Trading Bot</b> 🚀 \n\n` +
//   `Supercharge your trading with our cutting-edge bot that tracks and capitalizes on Serum migrations from Pump.fun! 💎\n\n` +
//   `Key Features:\n` +
//   `✅ Lightning-fast transaction tracking\n` +
//   `✅ Instant buy execution\n` +
//   `✅ Smart auto-buy/sell based on MC\n` +
//   `✅ Real-time Telegram alerts\n\n` +
//   `How it works:\n\n` +
//   `🔍 Monitors Pump.fun migrations to Serum\n` +
//   `💨 Executes rapid buy orders upon detection\n` +
//   `📊 Tracks market cap in real-time\n` +
//   `💰 Triggers auto-sell when your conditions are met\n\n` +
//   `Join the trading revolution today! 🌟`;

export const swapSuccessText = (tokenInfo: any, signature: string, solAmount: number, tokenAmount: number) => {
  return (
    `🟢 <b>Buying <b>${tokenInfo.symbol || tokenInfo.name}</b> is success</b>.\n` +
    `You bought <b>${roundToSpecificDecimal(tokenAmount / 10 ** tokenInfo.decimals, 4)}</b> ` +
    `${tokenInfo.symbol || tokenInfo.name} using <b>${solAmount}</b> XRP.\n` +
    `📝<a href='${process.env.XRP_TX_SCAN_URL}/${signature}'>Transaction</a>`
  );
};

export const settingText =
  `🛠️ <b>XRP Trading Bot Settings</b>\n\n` +
  `Welcome to the settings page for your XRP Trading Bot!\n\n` +
  `🔧 <b>Please adjust these settings according to your trading strategy and preferences.</b>`;

export const buySuccessText = async (address: string, name: string, xrp: number, other: number, hash: string, price: number) => {
  return (
    `🟢 <b>Buying <b>${name}</b> is success! 🟢</b>\n` +
    `<code>${address}</code>\n` +
    `You bought <b>${other} ${name}</b> using <b>${xrp} XRP</b>\n` +
    `Price: <b>$${roundToSpecificDecimal(price, 8)}</b>\n` +
    `📝 <a href='${process.env.XRP_TX_SCAN_URL || ''}/${hash}'>Transaction</a>`
  );
};

export const sellSuccessText = async (address: string, name: string, xrp: number, other: number, hash: string, price: number) => {
  return (
    `🟢 <b>Selling <b>${name}</b> is success! 🟢</b>\n` +
    `<code>${address}</code>\n` +
    `You sold <b>${other} ${name}</b> for <b>${xrp} XRP</b>\n` +
    `Price: <b>$${roundToSpecificDecimal(price, 8)}</b>\n` +
    `📝 <a href='${process.env.XRP_TX_SCAN_URL || ''}/${hash}'>Transaction</a>`
  );
};

export async function tokenText(
  address: string,
  info: {
    price: any;
    priceUsd: any;
    issuer: any;
    address: any;
    name: any;
    marketCap: any;
    liquidity: any;
  },
  pubKey: string
) {
  const balance = await getSpecificTokenBalance(pubKey, address.split('.')[0], address.split('.')[1]);
  const xrpBalance = await getBalanceOfWallet(pubKey);
  return (
    `📌 ${info.name}\n` +
    `<code>${address}</code>\n\n` +
    // `${name} Balance: <b>${balance}</b>` +
    `💳Wallet： \n` +
    `|——Price： $${info.priceUsd}\n` +
    `|——Balance： ${roundToSpecificDecimal(xrpBalance, 2)} XRP\n` +
    `|___ Holding：${roundToSpecificDecimal(Number(balance) * info.price, 2)} XRP — ${roundToSpecificDecimal(Number(balance), 6)} ${info.name}`
  );
  // `💵Trade: \n` +
  // `|——Market Cap: ${info.marketCap}\n` +
  // `|——Price: ${info.price}\n` +
  // `|___PepeBoost Buyers: ${info.holders}`
}

export function inviteFriendsText(user: UserType) {
  return `🔗 Invite link： https://t.me/ReferralFeeBot?start=${user.referralCode}

👥 Total invited：${user.children.length} people
💰 Referral earning：${user.referralEarns}XRP

📖 Rules:
1. Earn 30%-20%-10% of invitees' revenue permanently `;
}
// 2. Withdrawals start from 0.01, max 1 request per 24h. Withdrawals will be auto triggered at 8:00 (UTC+8) daily and will be credited within 24 hours after triggering.

// 💵 Withdrawable: 0 XRP ($0)(0 XRP pending)referralEarns
// 💰 Total withdrawn: 0 XRP ($0)
// 💳 Receiving address: null

export function limitOrderText(user: UserType) {
  if (user.orders.length > 0) {
    let message = `Existing Orders：\n\n`;
    user.orders.forEach((o) => {
      message += `${o.type === 'Buy' ? '🟢' : '🔴'} ${o.type} <a href='${process.env.XRP_TOKEN_SCAN_URL}/${o.address}'>${o.name}</a> (${o.amount} ${
        o.type === 'Buy' ? 'XRP' : '%'
      }) <a href='https://t.me/xrp_auto_bot?start=${o.uuid}'>[Close]</a>\n`;
      message += `• Target Price： $${o.price}\n`;
      message += `• Expiration： ${new Date(o.expiry).toLocaleString()}\n\n`;
    });
    return message;
  }
  return (
    `Add orders based on specified prices or percentage changes. Bot will automatically trigger buy or sell actions, facilitating take profit and stop loss\n\n` +
    `✅The trigger price of the limit order and the actual initiation price have a 1% tolerance. The trading mode will follow your selections in the trading panel. Turbo mode is quicker, and Anti-MEV mode is safer.`
  );
}

export function addOrderText(text: string, name: string, price: string) {
  return `📌 <b>${name}</b>
<code>${text}</code>(Click to Copy)
Current Price： $${price}

Limit orders support take-profit and stop-loss. Click the sell button to set.

Add orders based on specified prices or percentage changes. Bot will automatically trigger buy or sell actions, facilitating take profit and stop loss

✅The trigger price of the limit order and the actual initiation price have a 1% tolerance. The trading mode will follow your selections in the trading panel. Turbo mode is quicker, and Anti-MEV mode is safer.`;
}

export const options = ['Buy at Specified Price', 'Sell at Specified Price', 'Buy for Price Change', 'Sell for Price Change'];

export async function limitOrderOptionsText(action: string, address: string, priceUsd: any) {
  try {
    switch (action) {
      case 'Buy at Specified Price':
        return (
          `Please enter the expected price and auto-buy amount, separated by a comma.\n\n` +
          `📍For example, entering 0.1,0.05 means buying automatically when the price reaches $0.1, and auto-buying 0.05 .\n` +
          `Current Price： <code>${priceUsd}</code>(Click to copy)\n` +
          `Last Trade Price： <code>0.000</code>(Click to copy)`
        );
      case 'Sell at Specified Price':
        return (
          `Please enter the expected price and auto-sell percentage, separated by a comma.\n\n` +
          `📍 For example, entering 0.1,30 means selling automatically when the price reaches $0.1, and auto-selling 30% \n` +
          `Current Price： <code>${priceUsd}</code>(Click to copy)\n` +
          `Last Trade Price： <code>0</code>(Click to copy)`
        );
      case 'Buy for Price Change':
        return (
          `Please enter the price change percentage and the automatic buy-in amount, separated by a comma. A positive number indicates an increase(take profit), while a negative number indicates a decrease(stop loss). For example:\n\n` +
          `📍20,0.05 means a 20% increase, buy in 0.05 XRP\n` +
          `📍-20,0.05 means a 20%decrease, buy in 0.05 XRP\n\n` +
          `🏷️ Current Price： <code>${priceUsd}</code>`
        );

      default:
        return (
          `Please enter the price change percentage and the automatic sell-out ratio, separated by a comma. A positive number indicates an increase, while a negative number indicates a decrease. For example:\n\n` +
          `📍20,50 means a 20% increase, sell out 50%\n` +
          `📍-20,50 means a 20% decrease, sell out 50%\n\n` +
          `🏷️ Current Price： <code>${priceUsd}</code>`
        );
    }
  } catch (error: any) {
    console.error(error);
    throw new Error(error.message || 'Unexpected error while getting limit order options.');
  }
}

export function addLimitOrderText(order: Order, price: string) {
  return `✅ <a href='${process.env.XRP_TOKEN_SCAN_URL}/${order.address}'>${order.name}</a> auto-${order.type.toLowerCase()} set successfully 

💰 ${order.type} Amount： <b>${order.amount} ${order.type === 'Sell' ? '%' : 'XRP'}</b>
🎰 Execution Price(Current)： <b>$${order.price} ($${price})</b>
🕐Expiration： <b>${new Date(order.expiry).toLocaleString()}</b>

📌 Purchase price may have discrepancies due to price or quantity change`;
}

// 🏦 Execution Market Value(Current): 99M (26.9M)

export async function assetText(user: UserType) {
  try {
    if (!user.wallet.address) {
      return 'You have no wallet';
    }
    const tokens = await getAllTokens(user.wallet.address);

    if (tokens.length === 0) {
      return 'No data yet';
    }

    let message = '💳Wallet：\n';
    tokens.map((t, index) => {
      message += `${index === tokens.length - 1 ? '|___' : '|——'}${t.name}： ${t.balance}\n`;
    });
    return message;
  } catch (error: any) {
    throw new Error(error.message || 'Unexpected error while fetching assets.');
  }
}
