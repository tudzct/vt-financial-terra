import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Requires a valid bearer JWT for protected application endpoints. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
