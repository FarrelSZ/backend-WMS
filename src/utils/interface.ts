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
