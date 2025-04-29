import { MyContext } from '../config/types';
import { addLimitOrderText, limitOrderOptionsText, limitOrderText, options } from '../models/text.model';
import { limitOrderMarkUp } from '../models/markup.model';
import { User } from '../models/user.model';
import { CallbackQuery } from 'telegraf/typings/core/types/typegram';
import { getTokenDetails } from '../utils/xrpl';
import { calculateTime, roundToSpecificDecimal } from '../utils/functions';

export async function limitOrderAction(ctx: MyContext) {
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

export async function expiryAction(ctx: MyContext) {
  try {
    const { message_id } = await ctx.reply('Enter the expiry of your limit order. Valid options are m (minutes), h (hours), and d (days). E.g. 60m or 5d');

    ctx.session.state = 'Expiry';
    ctx.session.messages.push(message_id);
  } catch (error) {
    console.error(error);
  }
}

export async function buySpecifiedPriceAction(ctx: MyContext) {
  try {
    const tgId = ctx.chat?.id;
    const action = (ctx.callbackQuery as CallbackQuery.DataQuery).data;

    const user = await User.findOne({ tgId });
    if (!user) {
      return;
    }

    const token = ctx.session.mint?.address;
    if (!token) {
      return;
    }

    const { priceUsd, name } = await getTokenDetails(token);
    if (options.includes(action)) {
      ctx.reply(await limitOrderOptionsText(action, ctx.session.mint?.address || '', priceUsd), { parse_mode: 'HTML' });
      ctx.session.state = action;
    } else {
      const time = calculateTime(ctx.session.expiry);
      let amount = 50;
      let currentPrice = priceUsd;

      if (action === 'At 100% Rise Sell 50%') {
        currentPrice *= 2;
      } else if (action === 'At 200% Rise Sell 100%') {
        currentPrice *= 3;
        amount = 100;
      }

      user.orders.push({
        type: 'Sell',
        address: ctx.session.mint?.address || '',
        expiry: Date.now() + time,
        price: roundToSpecificDecimal(currentPrice),
        amount,
        uuid: Date.now() + time,
        name,
        initialPrice: priceUsd,
      });

      await user.save();
      ctx.reply(addLimitOrderText(user.orders[user.orders.length - 1], priceUsd), {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      });
      ctx.session.state = '';
    }
  } catch (error) {
    console.error(error);
  }
}
