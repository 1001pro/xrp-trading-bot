import { User } from '../models/user.model';
import { MyContext } from '../config/types';
import { newUserText, settingText } from '../models/text.model';
import { walletMarkUp, settingMarkUp } from '../models/markup.model';
import { CallbackQuery } from 'telegraf/typings/core/types/typegram';

/**
 * The function to handle 'Wallet' action
 * @param {MyContext} ctx
 */
export const walletAction = async (ctx: MyContext) => {
  try {
    const tgId = ctx.chat?.id;
    const user = await User.findOne({ tgId });
    if (!user) {
      await ctx.reply("We can't find you. Please enter /start command and then try again.");
      return;
    }
    ctx.editMessageText(await newUserText(user), { parse_mode: 'HTML', reply_markup: walletMarkUp.reply_markup });
  } catch (error) {
    console.error('Error while walletAction:', error);
  }
};
