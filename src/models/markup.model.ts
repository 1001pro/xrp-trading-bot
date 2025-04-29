import { Markup } from 'telegraf';
import { UserType } from './user.model';
import { getBalanceOfWallet } from '../utils/xrpl';
import { LinkPreviewOptions, ParseMode } from 'telegraf/typings/core/types/typegram';

export const startMarkUp = (hasWallet: boolean) => {
  try {
    return Markup.inlineKeyboard([
      !hasWallet ? [Markup.button.callback('📥 Import Wallet', 'Import Wallet'), Markup.button.callback('💳 Generate Wallet', 'Generate Wallet')] : [],
      [Markup.button.callback('💳 Wallet', 'Wallet'), Markup.button.callback('🏦 Asset', 'Asset')],
      [Markup.button.callback('💰 Buy/Sell', 'Buy/Sell'), Markup.button.callback('📌 Limit Order', 'Limit Order')],
      [Markup.button.callback('🏆 Invite friends', 'Invite friends'), Markup.button.callback('💸 Withdraw', 'Withdraw')],
      [Markup.button.callback('📖 Help', 'Help'), Markup.button.callback('✖ Close', 'Close')],
    ]).reply_markup;
  } catch (error) {
    console.error('Error while startMarkUp:', error);
    throw new Error('Failed to create markup for start command');
  }
};

export const settingMarkUp = async (user: UserType) => {
  const balance = await getBalanceOfWallet(user.wallet.address);
  try {
    return {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback(`💳 Wallet (${balance})`, 'Wallet')],
        [Markup.button.callback('🔙 Back', 'Return'), Markup.button.callback('✖ Close', 'Close')],
      ]).reply_markup,
      parse_mode: 'HTML' as ParseMode,
    };
  } catch (error) {
    console.error('Error while settingMarkUp:', error);
    throw new Error('Failed to create markup for user settings.');
  }
};

export const closeMarkUp = Markup.inlineKeyboard([[Markup.button.callback('✖ Close', 'Close')]]);

export const walletMarkUp = Markup.inlineKeyboard([[Markup.button.callback('🔙 Back', 'Setting'), Markup.button.callback('✖ Close', 'Close')]]);

export const helpMarkup = Markup.inlineKeyboard([[Markup.button.callback('🔙 Back', 'Return'), Markup.button.callback('✖ Close', 'Close')]]);

export const tokenMarkUp = (user: UserType) => {
  return {
    reply_markup: Markup.inlineKeyboard([
      [
        // Markup.button.callback(`Buy ${user.snipeAmount} XRP (You set)`, 'Buy default XRP'),
        Markup.button.callback(`Buy X XRP`, 'Buy X XRP'),
      ],
      [
        Markup.button.callback(`Buy 10 XRP`, 'Buy 10 XRP'),
        Markup.button.callback(`Buy 5 XRP`, 'Buy 5 XRP'),
        Markup.button.callback(`Buy 2 XRP`, 'Buy 2 XRP'),
        Markup.button.callback(`Buy 1 XRP`, 'Buy 1 XRP'),
      ],
      // [
      //   Markup.button.callback('Transfer Token', 'Transfer Token'),
      //   Markup.button.callback('Transfer XRP', 'Transfer XRP'),
      // ],
      ...sellPart,
      [Markup.button.callback('🔙 Back', 'Return'), Markup.button.callback('✖ Close', 'Close')],
    ]).reply_markup,
    parse_mode: 'HTML' as ParseMode,
    link_preview_options: {
      is_disabled: true,
    } as LinkPreviewOptions,
  };
};

export const sellMarkUp = () => {
  return {
    reply_markup: Markup.inlineKeyboard([...sellPart]).reply_markup,
    parse_mode: 'HTML' as ParseMode,
  };
};

const sellPart = [
  [
    // Markup.button.callback('25%', 'Sell 25 %'),
    Markup.button.callback('Sell 50%', 'Sell 50 %'),
    // Markup.button.callback('75%', 'Sell 75 %'),
    Markup.button.callback('Sell 100%', 'Sell 100 %'),
    Markup.button.callback('Sell X %', 'Sell X %'),
  ],
  // [
  //   // Markup.button.callback('Sell X XRP', 'Sell X XRP'),
  //   Markup.button.callback('Sell X Tokens', 'Sell X Tokens'),
  // ],
];

export function returnMarkUp(to: string) {
  return {
    reply_markup: Markup.inlineKeyboard([[Markup.button.callback('🔙 Return', to), Markup.button.callback('✖ Close', 'Close')]]).reply_markup,
    parse_mode: 'HTML' as ParseMode,
  };
}

export const limitOrderMarkUp = {
  reply_markup: Markup.inlineKeyboard([
    [Markup.button.callback('🔖 Existing Orders', 'Existing Orders')],
    [Markup.button.callback('Add Limit Order', 'Add Limit Order')],
    // [Markup.button.callback('Close All', 'Close All')],
  ]).reply_markup,
  parse_mode: 'HTML' as ParseMode,
  link_preview_options: {
    is_disabled: true,
  } as LinkPreviewOptions,
};

export function addOrderMarkUp(expiry: string) {
  return {
    reply_markup: Markup.inlineKeyboard([
      [Markup.button.callback(`✏ Expiry: ${expiry}`, 'Expiry')],
      [Markup.button.callback(`🟢 Buy at Specified Price`, 'Buy at Specified Price'), Markup.button.callback(`🔴 Sell at Specified Price`, 'Sell at Specified Price')],
      [Markup.button.callback(`🟢 Buy for Price Change`, 'Buy for Price Change'), Markup.button.callback(`🔴 Sell for Price Change`, 'Sell for Price Change')],
      [Markup.button.callback(`At 100% Rise Sell 50%`, 'At 100% Rise Sell 50%'), Markup.button.callback(`At 200% Rise Sell 100%`, 'At 200% Rise Sell 100%')],
      [Markup.button.callback(`Save`, 'Save')],
    ]).reply_markup,
    parse_mode: 'HTML' as ParseMode,
  };
}
