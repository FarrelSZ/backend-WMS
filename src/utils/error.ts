export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public optional: any[] = [],
  ) {
    super(message);
  }
}
