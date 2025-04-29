import BigNumber from 'bignumber.js';
import { bot } from '../config/config';
import { User } from '../models/user.model';
import { buyToken, getAvailableBalanceOfWallet, getBalanceOfWallet, getSpecificTokenBalance, getTokenDetails, getTokensDetails, sellToken } from './xrpl';

let inCron = false;

export async function cron() {
  try {
    if (inCron === true) return;
    inCron = true;

    console.log('Cronning ...');
    const users = await User.find({ orders: { $exists: true, $ne: [] } });
    console.log('users:', users, users.length);

    console.log('one =====')
    await Promise.all(
      users.map(async (user) => {
        const availableBalance = await getAvailableBalanceOfWallet(user.wallet.address);
        console.log('avaialblebalance,  orders.length', availableBalance, user.orders.length);

        const removeItemIndexes: { index: number; type: string }[] = [];

        for (const [index, order] of user.orders.entries()) {
          try {
            const os: string[] = order.address.split('.');

            if (order.type === 'Buy') {
              // Check if available balance is sufficient
              if (availableBalance < order.amount) {
                removeItemIndexes.push({ index, type: 'fail' });
                continue; // Skip to the next order
              }
              console.log('passed balance checking');

              // Check if the order has expired
              if (Date.now() > order.uuid) {
                removeItemIndexes.push({ index, type: 'time over' });
                continue; // Skip to the next order
              }
              console.log('passed expiry checking');

              // Fetch the token price
              const { priceUsd: price } = await getTokenDetails(order.address);

              // Check if the price meets the buy condition
              if (price < order.price) {
                const result = await buyToken(os[0], os[1], order.name, order.amount.toString(), user.wallet.seed, user, price);
                if (result === true) removeItemIndexes.push({ index, type: 'success' });
                console.log(`Handled ${user.tgId}'s ${index}th order.`);
                console.log('removeItemIndexes', removeItemIndexes);
              }
            } else {
              // Fetch the token balance
              const tokenBalance = await getSpecificTokenBalance(user.wallet.address, os[0], os[1]);
              console.log('tokenbalance', tokenBalance);

              // Check if the token balance is zero
              if (Number(tokenBalance) === 0) {
                removeItemIndexes.push({ index, type: 'fail' });
                continue; // Skip to the next order
              }
              console.log('passed balance checking');

              // Check if the order has expired
              if (Date.now() > order.uuid) {
                removeItemIndexes.push({ index, type: 'time over' });
                continue; // Skip to the next order
              }
              console.log('passed expiry checking');

              // Fetch the token price
              const { priceUsd: price } = await getTokenDetails(order.address);
              console.log('Current Price', price, order.price, order.initialPrice);

              // Check if the price meets the sell condition
              if (price > order.price) {
                const result = await sellToken(
                  os[0],
                  os[1],
                  order.name,
                  new BigNumber(Number(tokenBalance)).multipliedBy(new BigNumber(order.amount)).dividedBy(new BigNumber(100)).toString(),
                  user.wallet.seed,
                  user,
                  price
                );
                if (result === true) removeItemIndexes.push({ index, type: 'success' });
              }
            }
          } catch (error) {
            console.error(`Error processing order at index ${index}:`, error);
            removeItemIndexes.push({ index, type: 'error' });
          }
        }

        for (const item of removeItemIndexes.sort((a, b) => b.index - a.index)) {
          const order = user.orders[item.index];
          if (item.type === 'fail') {
            bot.telegram.sendMessage(
              user.tgId,
              `❌ Insufficient wallet balance, automatically close pending ${order.type.toLowerCase()} order:\n` + `📌 ${order.name}\n` + `<code>${order.address}</code>`,
              { parse_mode: 'HTML' }
            );
          } else if (item.type === 'time over') {
            bot.telegram.sendMessage(
              user.tgId,
              `❌ Order has expired, automatically close pending ${order.type.toLowerCase()} order:\n` + `📌 ${order.name}\n` + `<code>${order.address}</code>`,
              { parse_mode: 'HTML' }
            );
          } else {
            // bot.telegram.sendMessage(user.tgId, '');
          }
          user.orders.splice(item.index, 1);
        }
        await user.save();
      })
    );
    console.log('two =====')
    inCron = false;
  } catch (error) {
    console.error(error);
    inCron = false;
  }
}

export async function batchCron() {
  try {
    const allOrders = await User.aggregate([
      { $match: { orders: { $exists: true, $ne: [] } } },
      { $unwind: '$orders' },
      {
        $project: {
          tgId: 1,
          wallet: 1,
          'orders.address': 1,
          'orders.name': 1,
          'orders.type': 1,
          'orders.expiry': 1,
          'orders.price': 1,
          'orders.initialPrice': 1,
          'orders.amount': 1,
          'orders.uuid': 1,
        },
      },
    ]);
    console.log('All Orders:', allOrders);

    const addresses = new Set();

    allOrders.forEach((a) => {
      addresses.add(a.orders.address);
    });

    console.log([...addresses]); // Convert Set back to array if needed
    const tokenDetails = await getTokensDetails([...addresses].join(','));

    return tokenDetails;
  } catch (error: any) {
    console.error('Error while batchCron', error);
  }
}
