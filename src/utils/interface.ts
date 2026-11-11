import { Request } from "express";

export interface pagination {
  totalPages: number;
  current: number;
  total: number;
}

export interface ITokenPayLoad {
  userId: string;
  email: string;
  role: string;
}

export interface IUserToken {
  id?: string;
  role: string;
}

export interface IReqUser extends Request {
  user?: IUserToken;
}
