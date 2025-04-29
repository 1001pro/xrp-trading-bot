import { amount } from '@metaplex-foundation/js';
import { Schema, model, Document } from 'mongoose';

interface Token {
  name?: string;
  symbol?: string;
  address: string;
  usedSolAmount: number;
  decimals?: number;
  amount: number;
  price?: number;
  status?: 'Bought' | 'Sold';
  risk?: number;
}

// Define the Wallet interface
interface Wallet {
  publicKey: string;
  privateKey: string;
  amount: number;
  classicAddress: string;
  seed: string;
  address: string;
}

export interface Order {
  type: string;
  price: number;
  initialPrice: number;
  address: string;
  name: string;
  expiry: number;
  amount: number;
  uuid: number;
}

// Define the User interface
export interface UserType extends Document {
  tgId: number;
  username: string;
  wallet: Wallet;
  isAdmin: boolean;
  tokens: Token[];
  referralCode: string;
  referralEarns: number;
  children: number[];
  parent: number;
  orders: Order[];
}

const UserSchema = new Schema({
  tgId: {
    type: Number,
    required: true,
    unique: true,
  },
  username: {
    type: String,
    default: '',
  },
  wallet: {
    publicKey: {
      type: String,
    },
    privateKey: {
      type: String,
    },
    amount: {
      type: Number,
      default: 0,
    },
    classicAddress: {
      type: String,
    },
    address: {
      type: String,
    },
    seed: {
      type: String,
      default: '',
    },
  },
  referralCode: {
    type: String,
    required: true,
    unique: true,
  },
  referralEarns: {
    type: Number,
    default: 0,
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  children: {
    type: [Number],
    default: [],
  },
  parent: {
    type: Number,
  },
  tokens: [
    {
      name: {
        type: String,
        default: '',
      },
      symbol: {
        type: String,
        default: '',
      },
      address: {
        type: String,
        required: true,
      },
      usedSolAmount: {
        type: Number,
        default: 0,
      },
      decimals: {
        type: Number,
        default: 0,
      },
      amount: {
        type: Number,
        required: true,
      },
      price: {
        type: Number,
        default: 0,
      },
      status: {
        type: String,
        default: 'Bought',
      },
      risk: {
        type: Number,
        default: 0,
      },
    },
  ],
  orders: [
    {
      address: {
        type: String,
        required: true,
      },
      name: {
        type: String,
        required: true,
      },
      expiry: {
        type: Date,
        default: Date.now() + 3 * 24 * 60 * 60 * 1000,
      },
      type: {
        type: String,
      },
      price: {
        type: Number,
        required: true,
      },
      initialPrice: {
        type: Number,
        required: true,
      },
      amount: {
        type: Number,
      },
      uuid: {
        type: Number,
        required: true,
      },
    },
  ],
});

export const User = model<UserType>('User', UserSchema, 'User');
