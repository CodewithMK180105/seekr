import { Request, Response, NextFunction } from 'express';
import { registerSchema, loginSchema, BadRequestError } from '@seekr/shared';
import { ApiResponse, UserDto } from '@seekr/types';
import { authService } from './auth.service.js';

const REFRESH_COOKIE_NAME = 'seekr_refresh_token';
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function register(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = registerSchema.parse(req.body);
    const result = await authService.register(input);

    res.cookie(REFRESH_COOKIE_NAME, result.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: REFRESH_COOKIE_MAX_AGE,
    });

    const response: ApiResponse<{ user: UserDto; accessToken: string }> = {
      success: true,
      data: {
        user: result.user,
        accessToken: result.tokens.accessToken,
      },
    };

    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
}

export async function login(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input);

    res.cookie(REFRESH_COOKIE_NAME, result.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: REFRESH_COOKIE_MAX_AGE,
    });

    const response: ApiResponse<{ user: UserDto; accessToken: string }> = {
      success: true,
      data: {
        user: result.user,
        accessToken: result.tokens.accessToken,
      },
    };

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}

export async function refresh(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token =
      req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;

    if (!token) {
      throw new BadRequestError('Refresh token is required');
    }

    const tokens = await authService.refresh(token);

    res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: REFRESH_COOKIE_MAX_AGE,
    });

    const response: ApiResponse<{ accessToken: string }> = {
      success: true,
      data: {
        accessToken: tokens.accessToken,
      },
    };

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}

export async function logout(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    res.clearCookie(REFRESH_COOKIE_NAME);

    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: 'Logged out successfully' },
    };

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}

export async function getMe(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await authService.getUserById(req.user!.userId);

    const response: ApiResponse<{ user: UserDto }> = {
      success: true,
      data: { user },
    };

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}
