import * as xrpl from 'xrpl';
import mongoose from 'mongoose';
import { Telegraf, session } from 'telegraf';
import { Connection, PublicKey } from '@solana/web3.js';
import { MyContext } from './types';
import { Order } from '../models/user.model';

//-------------------------------------------------------------------------------------------------------------+
//                                                Constants                                                    |
//-------------------------------------------------------------------------------------------------------------+

export const BOT_TOKEN = process.env.BOT_TOKEN || '';
export const MONGO_URI = process.env.MONGO_URI || '';

export const ADMIN_WALLET = process.env.ADMIN_WALLET || '';
export const EVERY_20_SECONDS = '*/20 * * * * *'; // Every 20 seconds, Realted to total count of batches in batchCron function of cron.ts
export const BASE_RESERVE = 1;
export const OWNER_RESERVE = 0.2;

//-------------------------------------------------------------------------------------------------------------+
//                                            Connect Database                                                 |
//-------------------------------------------------------------------------------------------------------------+

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('Database is connected');
  })
  .catch((error) => {
    console.error('Error while connecting the database:', error);
  });

export const CLIENT = new xrpl.Client(process.env.RPC_URL || 'wss://xrplcluster.com/');
CLIENT.connect().finally(() => {
  console.log('Connected to xrpl network.');
});

//-------------------------------------------------------------------------------------------------------------+
//                                             Configure Bot                                                   |
//-------------------------------------------------------------------------------------------------------------+

export const bot = new Telegraf<MyContext>(BOT_TOKEN);

/**
 * Set the session to use
 */
bot.use(session());
bot.use((ctx, next) => {
  try {
    if (!ctx.session) {
      ctx.session = {
        state: '',
        mint: undefined,
        messages: [],
        expiry: '3d',
        withdrawAddress: '',
      };
    }
    return next();
  } catch (error) {
    console.error('Error while setting the session:', error);
  }
});
