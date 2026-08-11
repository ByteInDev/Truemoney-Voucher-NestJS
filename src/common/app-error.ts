export class AppError extends Error {
  constructor(
    readonly code: number,
    readonly message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const ErrBadRequest = (): AppError =>
  new AppError(400, 'Bad Request', 200);

export const ErrNotFound = (): AppError => new AppError(404, 'Not Found', 404);

export const ErrInternal = (): AppError =>
  new AppError(500, 'Internal Server Error', 200);
