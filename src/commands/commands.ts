import { bot } from '../config/config';
import { MyContext } from '../config/types';
import { User, UserType } from '../models/user.model';
import { generateReferralCode } from '../utils/functions';
import { Chat } from 'telegraf/typings/core/types/typegram';
import { startMarkUp, settingMarkUp, limitOrderMarkUp, helpMarkup, walletMarkUp } from '../models/markup.model';
import { assetText, helpText, inviteFriendsText, limitOrderText, newUserText, settingText, startText } from '../models/text.model';

export const startCommand = async (ctx: MyContext) => {
  ctx.session.state = '';
  try {
    const tgId = ctx.chat?.id;
    if (!tgId) {
      return;
    }
    const username = (ctx?.chat as Chat.PrivateChat).username || '';
    let user = await User.findOne({ tgId });

    const referralCode = ctx.text?.split(' ')[1];

    if (!user) {
      let referralUser: UserType | null | undefined = undefined;
      if (referralCode) {
        referralUser = await User.findOneAndUpdate({ referralCode }, { $addToSet: { children: tgId } }, { new: true });
      }
      const uuid = generateReferralCode();
      const newUser = new User({
        tgId,
        username,
        referralCode: uuid,
        parent: referralUser?.tgId,
      });
      user = await newUser.save();
    }

    if (referralCode && referralCode.split('-').length === 1) {
      user.orders = user.orders.filter((o) => o.uuid.toString() !== referralCode);
      user = await user.save();
    }

    await ctx.reply(await startText(user), { parse_mode: 'HTML', reply_markup: startMarkUp(!!user.wallet.address) });
  } catch (error) {
    console.error('Error while starting the bot:', error);
    await ctx.reply('An error occured while starting. Please try again later.');
  }
};

export const helpCommand = async (ctx: MyContext) => {
  try {
    ctx.reply(helpText, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('Error while helpCommand:', error);
  }
};

export async function limitOrderCommand(ctx: MyContext) {
  const tgId = ctx.chat?.id;
  const user = await User.findOne({ tgId });
  if (!user) {
    throw new Error('User not found');
  }
  try {
    ctx.reply(limitOrderText(user), limitOrderMarkUp);
  } catch (error) {
    console.error(error);
  }
}

export const settingCommand = async (ctx: MyContext) => {
  try {
    const tgId = ctx.chat?.id;
    const user = await User.findOne({ tgId });

    if (!user) {
      throw new Error('User not found!');
    }
    await ctx.reply(settingText, await settingMarkUp(user));
  } catch (error) {
    console.error('Error while settingCommand:', error);
    await ctx.reply('An error occurred while fetching your settings. Please try again later.');
  }
};

export const referralCommand = async (ctx: MyContext) => {
  const tgId = ctx.chat?.id;
  const user = await User.findOne({ tgId });
  if (!user) {
    return;
  }
  try {
    ctx.reply(inviteFriendsText(user), helpMarkup);
  } catch (error) {
    console.error('Error while closeAction:', error);
  }
};

export const walletCommand = async (ctx: MyContext) => {
  try {
    const tgId = ctx.chat?.id;
    const user = await User.findOne({ tgId });
    if (!user) {
      await ctx.reply("We can't find you. Please enter /start command and then try again.");
      return;
    }
    ctx.reply(await newUserText(user), { parse_mode: 'HTML', reply_markup: walletMarkUp.reply_markup });
  } catch (error) {
    console.error('Error while walletAction:', error);
  }
};

export const assetCommand = async (ctx: MyContext) => {
  try {
    const tgId = ctx.chat?.id;
    const user = await User.findOne({ tgId });
    if (!user) {
      await ctx.reply("We can't find you. Please enter /start command and then try again.");
      return;
    }
    ctx.reply(await assetText(user), helpMarkup);
  } catch (error) {
    console.error('Error while walletAction:', error);
  }
};

export const setCommands = async () => {
  try {
    const commands = [
      { command: '/start', description: 'Start the bot' },
      { command: '/setting', description: 'Setting' },
      { command: '/limit', description: 'Limit orders' },
      { command: '/help', description: 'Help' },
      { command: '/referral', description: 'Referral rewards' },
      { command: '/wallet', description: 'Wallet' },
      { command: '/asset', description: 'Check all tokens' },
    ];
    const result = await bot.telegram.setMyCommands(commands);
    if (!result) {
      throw new Error('Something went wrong while setting comands.');
    }
  } catch (error) {
    console.error('Error while setCommands:', error);
  }
};
