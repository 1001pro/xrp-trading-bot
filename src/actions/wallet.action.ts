import { User } from '../models/user.model';
import { MyContext } from '../config/types';
import { generateWallet } from '../utils/xrpl';
import { newUserText } from '../models/text.model';
import { helpMarkup } from '../models/markup.model';

export async function importWalletAction(ctx: MyContext) {
  try {
    const tgId = ctx.chat?.id;
    const user = await User.findOne({ tgId });
    if (!user) {
      throw new Error('User not found!');
    }

    if (user.wallet.seed) {
      await ctx.reply('You have already wallet.');
      return;
    }

    await ctx.reply('Please enter the seed of wallet.');
    ctx.session.state = 'Import Wallet';
  } catch (error) {
    console.error(error);
  }
}

export async function generateWalletAction(ctx: MyContext) {
  try {
    const tgId = ctx.chat?.id;
    const user = await User.findOne({ tgId });
    if (!user) {
      throw new Error('User not found!');
    }

    if (user.wallet.seed) {
      await ctx.reply('You have already wallet.');
      return;
    }

    const wallet = await generateWallet();
    user.wallet = {
      address: wallet.address,
      classicAddress: wallet.classicAddress,
      seed: wallet.seed || '',
      publicKey: wallet.publicKey,
      privateKey: wallet.privateKey,
      amount: 0,
    };

    await user.save();
    ctx.editMessageText(await newUserText(user), { parse_mode: 'HTML', reply_markup: helpMarkup.reply_markup });
  } catch (error) {
    console.error(error);
  }
}

export async function withdrawAction(ctx: MyContext) {
  try {
    const tgId = ctx.chat?.id;
    const user = await User.findOne({ tgId });
    if (!user) {
      throw new Error('User not found!');
    }

    if (!user.wallet.seed) {
      await ctx.reply('You have no wallet.');
      return;
    }

    ctx.reply('Please enter the wallet address to withdraw');
    ctx.session.state = 'Withdraw';
  } catch (error) {
    console.error(error);
  }
}
