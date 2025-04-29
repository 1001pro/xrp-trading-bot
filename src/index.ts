import dotenv from 'dotenv';
dotenv.config({
  path: './.env',
});

import { EVERY_20_SECONDS, bot } from './config/config';
import { User } from './models/user.model';
import { CronJob } from 'cron';
import { calculateTime, clearTempMessages, isNumber, isValidExpiry, isValidWalletAddress, roundToSpecificDecimal } from './utils/functions';
import { addLimitOrderText, addOrderText, newUserText, options, tokenText } from './models/text.model';
import { addOrderMarkUp, helpMarkup, tokenMarkUp } from './models/markup.model';
import { checkAction, checkUser } from './utils/middleware';
import { startCommand, helpCommand, setCommands, settingCommand, limitOrderCommand, referralCommand, walletCommand, assetCommand } from './commands/commands';
import { limitOrderAction, expiryAction, buySpecifiedPriceAction } from './actions/order.action';
import {
  settingAction,
  closeAction,
  returnAction,
  helpAction,
  buyTokenAction,
  sellTokenAction,
  transferTokenAction,
  inviteFriendsAction,
  buySellSction,
  assetAction,
} from './actions/general.action';
import { walletAction } from './actions/setting.action';
import {
  buyToken,
  generateWalletFromSeed,
  getSpecificTokenBalance,
  isValidToken,
  sellToken,
  getTokenDetails,
  tokenTransfer,
  isValidXRPAddress,
  getAvailableBalanceOfWallet,
} from './utils/xrpl';
import { generateWalletAction, importWalletAction, withdrawAction } from './actions/wallet.action';
import { batchCron, cron } from './utils/cron';

//-------------------------------------------------------------------------------------------------------------+
//                                             Set the commands                                                |
//-------------------------------------------------------------------------------------------------------------+

bot.command('start', startCommand);
bot.command('help', helpCommand);
bot.command('setting', settingCommand);
bot.command('limit', limitOrderCommand);
bot.command('referral', referralCommand);
bot.command('wallet', walletCommand);
bot.command('asset', assetCommand);

//-------------------------------------------------------------------------------------------------------------+
//                                   The part to listen the messages from bot                                  |
//-------------------------------------------------------------------------------------------------------------+

bot.on('text', async (ctx) => {
  const botState = ctx.session.state;
  const text = ctx.message.text;
  const tgId = ctx.chat.id;

  ctx.session.messages.push(ctx.message.message_id);
  try {
    const user = await User.findOne({ tgId });
    if (!user) {
      throw new Error('User not found');
    }

    if (botState === 'Buy X Amount') {
      if (!isNumber(text)) {
        ctx.reply('Please enter the number.');
        return;
      }

      if (!ctx.session.mint) {
        ctx.reply('Pease enter the token address at first.');
        return;
      }
      const token = ctx.session.mint.address.split('.');
      const balance = await getAvailableBalanceOfWallet(user.wallet.address);
      if (balance < Number(text)) {
        ctx.reply(`Insufficient balance. Your wallet available balance is ${roundToSpecificDecimal(balance, 4)} XRP but you tried with ${text} XRP`);
        return;
      }
      buyToken(token[0], token[1], ctx.session.mint.name, text, user.wallet.seed || '', user, Number(ctx.session.mint.price));
      ctx.session.state = '';

      // The part to control the event of entering token address or invalid command
    } else if (botState === 'Import Wallet') {
      const wallet = generateWalletFromSeed(text);

      user.wallet = {
        address: wallet.address,
        classicAddress: wallet.classicAddress,
        seed: wallet.seed || '',
        publicKey: wallet.publicKey,
        privateKey: wallet.privateKey,
        amount: 0,
      };

      await user.save();

      ctx.reply(await newUserText(user), { parse_mode: 'HTML', reply_markup: helpMarkup.reply_markup });
    } else if (botState === 'Sell X %') {
      if (!isNumber(text)) {
        ctx.reply('Please enter the number.');
        return;
      }

      if (!ctx.session.mint) {
        ctx.reply('Pease enter the token address at first.');
        return;
      }

      const token = ctx.session.mint.address.split('.');
      const balance = await getSpecificTokenBalance(user.wallet.address, token[0], token[1]);
      const amount = (Number(balance) * Number(text)) / 100;

      sellToken(token[0], token[1], ctx.session.mint.name, amount.toString(), user.wallet.seed, user, Number(ctx.session.mint.price));
      ctx.session.state = '';

      // The part to control the event of entering token address or invalid command
    } else if (botState === 'Transfer Token') {
      if (!isValidWalletAddress(text)) {
        ctx.reply('Invalid wallet address');
        return;
      }

      const mint = ctx.session.mint;
      if (!mint) {
        ctx.reply('Please enter the token address before withdraw');
        return;
      }

      const token = mint.address.split('.');
      const balance = await getSpecificTokenBalance(user.wallet.publicKey, token[0], token[1]);
      // await transferToken(new PublicKey(mint), new PublicKey(text), balanceInLamp, balanceNoLamp, user);
      ctx.session.state = '';
    } else if (botState === 'Transfer XRP') {
      if (!isValidWalletAddress(text)) {
        ctx.reply('Invalid wallet address');
        return;
      }

      // const lamports = await getBalanceOfWallet(user.wallet.publicKey);
      // await transferTotalSol(new PublicKey(text), lamports, user);
      ctx.session.state = '';
    } else if (botState === 'Add Limit Order') {
      // Check whether it is valid token or not
      const isValid = await isValidToken(text);

      // If it is invalid
      if (!isValid) {
        const { message_id } = await ctx.reply('Invalid token address. Confirm again and enter the valid one.');
        ctx.session.messages.push(message_id);
        return;
      }

      const info = await getTokenDetails(text);
      ctx.session.mint = {
        address: text,
        name: info.name,
        issuer: info.issuer,
        marketCap: info.marketCap,
        price: info.price,
        liquidity: info.liquidity,
      };
      ctx.reply(addOrderText(text, info.name, info.priceUsd), addOrderMarkUp(ctx.session.expiry));
      clearTempMessages(ctx);
      ctx.session.state = '';
    } else if (options.includes(botState)) {
      const texts = text.split(',');
      if (texts.length !== 2 || isNaN(Number(texts[0])) || isNaN(Number(texts[1]))) {
        ctx.reply('❌ Incorrect format. Please enter two value separated by a comma.');
        return;
      }

      const token = ctx.session.mint?.address;
      if (!token) {
        return;
      }

      const { priceUsd, name } = await getTokenDetails(token);
      const time = calculateTime(ctx.session.expiry);

      if (botState === 'Buy at Specified Price') {
        user.orders.push({
          type: 'Buy',
          address: token,
          expiry: Date.now() + time,
          price: Number(texts[0]),
          amount: Number(texts[1]),
          uuid: Date.now() + time,
          name,
          initialPrice: priceUsd,
        });
      } else if (botState === 'Sell at Specified Price') {
        user.orders.push({
          type: 'Sell',
          address: ctx.session.mint?.address || '',
          expiry: Date.now() + time,
          price: Number(texts[0]),
          amount: Number(texts[1]),
          uuid: Date.now() + time,
          name,
          initialPrice: priceUsd,
        });
      } else if (botState === 'Buy for Price Change') {
        user.orders.push({
          type: 'Buy',
          address: ctx.session.mint?.address || '',
          expiry: Date.now() + time,
          price: Number(priceUsd) + (priceUsd * Number(texts[0])) / 100,
          amount: Number(texts[1]),
          uuid: Date.now() + time,
          name,
          initialPrice: priceUsd,
        });
      } else {
        user.orders.push({
          type: 'Sell',
          address: ctx.session.mint?.address || '',
          expiry: Date.now() + time,
          price: Number(priceUsd) + (priceUsd * Number(texts[0])) / 100,
          amount: Number(texts[1]),
          uuid: Date.now() + time,
          name,
          initialPrice: priceUsd,
        });
      }
      await user.save();

      ctx.reply(addLimitOrderText(user.orders[user.orders.length - 1], priceUsd), {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      });
      ctx.session.state = '';
    } else if (botState === 'Expiry') {
      if (!isValidExpiry(text)) {
        ctx.reply("Invalid time unit, use either 'm', 'h', or 'd'");
        return;
      }

      ctx.session.expiry = text;
    } else if (botState === 'Withdraw') {
      const isValid = isValidXRPAddress(text);
      if (!isValid) {
        ctx.reply('The wallet address you entered is invalid. Please double-check and enter a valid XRP address.');
        return;
      }

      if (text === user.wallet.address) {
        ctx.reply(`Withdrawing attempt to the same wallet. Your wallet address is ${user.wallet.address}`);
        return;
      }

      ctx.reply(`Please enter the amount to withdraw to <code>${text}</code>`, { parse_mode: 'HTML' });
      ctx.session.withdrawAddress = text;
      ctx.session.state = 'Withdraw Amount';
    } else if (botState === 'Withdraw Amount') {
      if (isNaN(Number(text))) {
        ctx.reply('Please enter the number.');
        return;
      }
      const wallet = generateWalletFromSeed(user.wallet.seed);

      const hash = await tokenTransfer(wallet, ctx.session.withdrawAddress, text);

      await ctx.reply(`Successfully withdrawed.\n <a href='${process.env.XRP_TX_SCAN_URL || ''}/${hash}'>Transaction</a>`, {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      });
      ctx.session.state = '';
      ctx.session.withdrawAddress = '';
    } else {
      // If it is invalid command
      if (text.startsWith('/')) {
        ctx.reply('⚠️ Unrecognizable commands. Input /help to see the help.');
        return;
      }

      // Check whether it is valid token or not
      const isValid = await isValidToken(text);

      // If it is invalid
      if (!isValid) {
        await ctx.reply('Invalid token address. Confirm again and enter the valid one.');
        return;
      }

      // const tokenInfo = await getTokenInfo(text);

      const info = await getTokenDetails(text);
      ctx.session.mint = {
        address: text,
        name: info.name,
        issuer: info.issuer,
        marketCap: info.marketCap,
        price: info.priceUsd,
        liquidity: info.liquidity,
      };
      await ctx.reply(await tokenText(text, info, user.wallet.address), tokenMarkUp(user));
    }
  } catch (error: any) {
    if (error.message === "Missing field 'account'.") {
      await ctx.reply('You have no wallet. Please import or generate new wallet.');
    } else if (error.message === 'Account not found.') {
      await ctx.reply('Your account is not activated. To activate your wallet please deposit 1 XRP.');
    } else {
      console.error('Error while on text:', error);
      await ctx.reply(error.message || 'Unexpected error while handling text message.');
    }
  }
});

//-------------------------------------------------------------------------------------------------------------+
//                                             Set the actions                                                 |
//-------------------------------------------------------------------------------------------------------------+

//---------------------------------------------------------------------+
//                         General Actions                             |
//---------------------------------------------------------------------+

/**
 * Catch the action when user clicks the 'Close' callback button
 */
bot.action('Close', (ctx, next) => checkAction(ctx, next, 'Close'), closeAction);

bot.action(/^Buy (default|\d+(\.\d+)?|X) XRP$/, (ctx, next) => checkAction(ctx, next, 'Buy X XRP'), buyTokenAction);

bot.action(/^Sell (\d+|X) (%|Tokens)$/, (ctx, next) => checkAction(ctx, next, 'Sell X XRP'), checkUser, sellTokenAction);

bot.action(['Transfer Token', 'Transfer XRP'], (ctx, next) => checkAction(ctx, next, ctx.match[0]), checkUser, transferTokenAction);

//---------------------------------------------------------------------+
//                      Actions on Start page                          |
//---------------------------------------------------------------------+

/**
 * Catch the action when user clicks the 'Start' callback button
 */
bot.action('Help', (ctx, next) => checkAction(ctx, next, 'Help'), helpAction);

/**
 * Catch the action when user clicks the 'Setting' callback button
 */
bot.action('Setting', (ctx, next) => checkAction(ctx, next, 'Setting'), settingAction);

//---------------------------------------------------------------------+
//                       Actions on Setting page                       |
//---------------------------------------------------------------------+

/**
 * Catch the action when user clicks the '💳 Wallet' callback button
 */
bot.action('Wallet', (ctx, next) => checkAction(ctx, next, 'Wallet'), walletAction);

bot.action('Import Wallet', (ctx, next) => checkAction(ctx, next, 'Import Wallet'), importWalletAction);

bot.action('Generate Wallet', (ctx, next) => checkAction(ctx, next, 'Generate Wallet'), generateWalletAction);

bot.action('Withdraw', (ctx, next) => checkAction(ctx, next, 'Withdraw'), withdrawAction);

bot.action('Asset', (ctx, next) => checkAction(ctx, next, 'Asset'), assetAction);

/**
 * Catch the action when user clicks the 'Bot On 🟢 || Bot Off 🔴' callback button
 */

bot.action(['Buy/Sell', 'Add Limit Order'], buySellSction);

bot.action('Limit Order', limitOrderAction);

bot.action('Expiry', expiryAction);

bot.action(
  ['Buy at Specified Price', 'Sell at Specified Price', 'Buy for Price Change', 'Sell for Price Change', 'At 100% Rise Sell 50%', 'At 200% Rise Sell 100%'],
  buySpecifiedPriceAction
);

/**
 * Catch the action when user clicks the 'Start' callback button
 */
bot.action('Return', (ctx, next) => checkAction(ctx, next, 'Return'), returnAction);

bot.action('Invite friends', inviteFriendsAction);

//-------------------------------------------------------------------------------------------------------------+
//                                    Set menu button to see all commands                                      |
//-------------------------------------------------------------------------------------------------------------+

/**
 * Set menu button representing all available commands
 */
setCommands();

/**
 * Launch the bot
 */
bot
  .launch(() => {
    console.log('Bot is running...');
  })
  .catch(console.error);

// batchCron();
const job = new CronJob(EVERY_20_SECONDS, cron); // Every 20 seconds
// const job = new CronJob('*/20 * * * *', cron); // Every minute

job.start();

process.on('SIGINT', () => {
  console.log('Successfully stopped');
  bot.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Successfully stopped');
  bot.stop();
  process.exit(0);
});
