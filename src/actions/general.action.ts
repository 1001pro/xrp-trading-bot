import { User } from '../models/user.model';
import { startText, helpText, settingText, inviteFriendsText, limitOrderText, assetText } from '../models/text.model';
import { settingMarkUp, startMarkUp, helpMarkup } from '../models/markup.model';
import { MyContext } from '../config/types';
import { CallbackQuery } from 'telegraf/typings/core/types/typegram';
import { buyToken, getAvailableBalanceOfWallet, getSpecificTokenBalance, sellToken } from '../utils/xrpl';
import BigNumber from 'bignumber.js';
import { roundToSpecificDecimal } from '../utils/functions';

/**
 * The function to handle 'Setting' action
 * @param {MyContext} ctx
 */
export const settingAction = async (ctx: MyContext) => {
  try {
    const tgId = ctx.chat?.id;
    const user = await User.findOne({ tgId });
    if (!user) {
      throw new Error('User not found!');
    }
    await ctx.editMessageText(settingText, await settingMarkUp(user));
  } catch (error) {
    // ctx.session.state = '';
    console.error('Error while settingActioin:', error);
  }
};

/**
 * The function to handle 'Close' action
 * @param {MyContext} ctx
 */
export const closeAction = (ctx: MyContext) => {
  try {
    ctx.deleteMessage();
  } catch (error) {
    console.error('Error while closeAction:', error);
  }
};

/**
 * The function to handle 'Return' action
 * @param {MyContext} ctx
 */
export const returnAction = async (ctx: MyContext) => {
  try {
    const tgId = ctx.chat?.id;
    const user = await User.findOne({ tgId });
    if (!user) {
      throw new Error('User not found!');
    }
    ctx.session.state = '';
    await ctx.editMessageText(await startText(user), {
      parse_mode: 'HTML',
      reply_markup: startMarkUp(!!user.wallet.address),
    });
  } catch (error) {
    console.error('Error while returnAction:', error);
  }
};

/**
 * The function to handle 'Help' action
 * @param {MyContext} ctx
 */
export const helpAction = async (ctx: MyContext) => {
  try {
    await ctx.editMessageText(helpText, { parse_mode: 'HTML', reply_markup: helpMarkup.reply_markup });
  } catch (error) {
    console.error('Error while helpAction:', error);
  }
};

/**
 * The function to handle 'Help' action
 * @param {MyContext} ctx
 */
export const buyTokenAction = async (ctx: MyContext) => {
  const callbackData = (ctx.callbackQuery as CallbackQuery.DataQuery).data;
  const amount = callbackData.split(' ')[1];
  let tradeAmount = 0;

  try {
    const tgId = ctx.chat?.id;
    const user = await User.findOne({ tgId });

    if (!user) {
      ctx.session.mint = undefined;
      ctx.session.state = '';
      ctx.reply("I can't find you. Please enter /start command and then try again.");
      return;
    }
    if (!ctx.session.mint) {
      ctx.session.state = '';
      ctx.reply('Please enter the token address and then try again.');
      return;
    }

    if (amount === 'X') {
      await ctx.reply('Please enter the amount you want to buy in XRP.');
      ctx.session.state = 'Buy X Amount';
      return;
    } else {
      tradeAmount = Number(amount);
    }
    const token = ctx.session.mint.address.split('.');
    const balance = await getAvailableBalanceOfWallet(user.wallet.address);
    if (balance < tradeAmount) {
      ctx.reply(`Insufficient balance. Your wallet available balance is ${roundToSpecificDecimal(balance, 4)} XRP but you tried with ${tradeAmount} XRP`);
      return;
    }
    buyToken(token[0], token[1], ctx.session.mint.name, tradeAmount.toString(), user.wallet.seed || '', user, Number(ctx.session.mint.price));
    ctx.session.state = '';
  } catch (error) {
    console.error('Error while helpAction:', error);
  }
};

export async function sellTokenAction(ctx: MyContext) {
  try {
    const callbackData = (ctx.callbackQuery as CallbackQuery.DataQuery).data;
    const tgId = ctx.chat?.id;

    const user = await User.findOne({ tgId });
    if (!user) {
      return;
    }

    const [_, ratio, unit] = callbackData.split(/\s+/);
    const possibleRatios = ['25', '50', '75', '100'];
    if (possibleRatios.includes(ratio)) {
      const mint = ctx.session.mint;
      if (!mint) {
        ctx.session.state = '';
        return;
      }

      const token = mint.address.split('.');

      const balance = await getSpecificTokenBalance(user.wallet.address, token[0], token[1]);
      const amount = new BigNumber(Number(balance)).multipliedBy(new BigNumber(Number(ratio))).dividedBy(new BigNumber(100));

      await sellToken(token[0], token[1], mint.name, amount.toString(), user.wallet.seed || '', user, Number(mint.price));
      ctx.session.state = '';
    } else if (unit === '%') {
      await ctx.reply('Please enter the ratio you want to sell.');
      ctx.session.state = 'Sell X %';
    } else {
      await ctx.reply('Please enter the amount you want to sell.');
      ctx.session.state = 'Sell X Tokens';
    }
  } catch (error) {
    ctx.session.state = '';
    console.error(error);
  }
}

export async function transferTokenAction(ctx: MyContext) {
  const callbackData = (ctx.callbackQuery as CallbackQuery.DataQuery).data;
  const tgId = ctx.chat?.id;
  const user = await User.findOne({ tgId });
  if (!user || !ctx.session.mint) {
    return;
  }
  try {
    const token = ctx.session.mint.address.split('.');
    const balance = await getSpecificTokenBalance(user.wallet.publicKey, token[0], token[1]);
    if (balance === '0') {
      await ctx.reply('The balance of this token is 0.');
      return;
    }
    ctx.reply('Input the wallet address to withdraw.');
    ctx.session.state = callbackData;
  } catch (error) {
    console.error(error);
  }
}

export async function inviteFriendsAction(ctx: MyContext) {
  const tgId = ctx.chat?.id;
  const user = await User.findOne({ tgId });
  if (!user) {
    return;
  }
  try {
    ctx.editMessageText(inviteFriendsText(user), helpMarkup);
  } catch (error) {
    console.error('Error while closeAction:', error);
  }
}

export async function buySellSction(ctx: MyContext) {
  const tgId = ctx.chat?.id;
  const user = await User.findOne({ tgId });

  const action = (ctx.callbackQuery as CallbackQuery.DataQuery).data;
  if (!user) {
    return;
  }
  try {
    const { message_id } = await ctx.reply(
      'Please enter the token contract address.\n' +
        'The format of a token address must be: Token Code . Issuer of Token\n' +
        'Example: <code>245852504D414E00000000000000000000000000.rpCB8upQziQR6P5YbHnZZAqqTMePQ8pCTR</code>',
      { parse_mode: 'HTML' }
    );

    ctx.session.state = action;
    ctx.session.messages.push(message_id);
  } catch (error) {
    console.error('Error while closeAction:', error);
  }
}

export async function assetAction(ctx: MyContext) {
  const tgId = ctx.chat?.id;
  const user = await User.findOne({ tgId });

  const action = (ctx.callbackQuery as CallbackQuery.DataQuery).data;
  if (!user) {
    return;
  }
  try {
    ctx.reply(await assetText(user), helpMarkup);
  } catch (error) {
    console.error('Error while closeAction:', error);
  }
}
