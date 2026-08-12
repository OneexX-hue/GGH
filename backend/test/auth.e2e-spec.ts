import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// e2e против реальной тестовой БД (carclub_test, отдельной от dev-базы —
// см. test/setup-env.ts). Требует применённых миграций + прогнанного
// prisma/seed.ts (создаёт multi-use инвайт TEST-INVITE-0001).
describe('Auth flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    prisma = moduleRef.get(PrismaService);

    const invite = await prisma.invite.findUnique({ where: { code: 'TEST-INVITE-0001' } });
    if (!invite) {
      throw new Error(
        'Тестовый инвайт TEST-INVITE-0001 не найден в carclub_test — запустите `npx prisma migrate deploy` и `npm run prisma:seed` с DATABASE_URL, указывающим на тестовую БД, перед npm run test:e2e',
      );
    }
  });

  afterAll(async () => {
    await app.close();
  });

  const password = 'TEST-e2e-password-123';
  const email = `e2e-${randomUUID()}@carclub.local`;

  it('POST /auth/register создаёт участника по валидному инвайт-коду и возвращает токены', async () => {
    const res = await request(app.getHttpServer()).post('/auth/register').send({
      inviteCode: 'TEST-INVITE-0001',
      email,
      password,
      displayName: 'E2E участник',
    });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
  });

  it('POST /auth/register отклоняет повторную регистрацию на тот же email', async () => {
    const res = await request(app.getHttpServer()).post('/auth/register').send({
      inviteCode: 'TEST-INVITE-0001',
      email, // тот же email, что и в предыдущем тесте
      password,
      displayName: 'Дубликат',
    });

    expect(res.status).toBe(409);
  });

  it('POST /auth/register отклоняет несуществующий инвайт-код', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        inviteCode: 'NONEXISTENT-CODE',
        email: `e2e-${randomUUID()}@carclub.local`,
        password,
        displayName: 'Кто-то',
      });

    expect(res.status).toBe(404);
  });

  it('POST /auth/login возвращает токены для верных учётных данных', async () => {
    const res = await request(app.getHttpServer()).post('/auth/login').send({
      identifier: email,
      password,
    });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
  });

  it('POST /auth/login отклоняет неверный пароль', async () => {
    const res = await request(app.getHttpServer()).post('/auth/login').send({
      identifier: email,
      password: 'неверный-пароль',
    });

    expect(res.status).toBe(401);
  });

  it('защищённый эндпоинт /users/me отклоняет запрос без токена', async () => {
    const res = await request(app.getHttpServer()).get('/users/me');
    expect(res.status).toBe(401);
  });

  it('защищённый эндпоинт /users/me отдаёт профиль с валидным access-токеном', async () => {
    const login = await request(app.getHttpServer()).post('/auth/login').send({ identifier: email, password });
    const res = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ displayName: 'E2E участник' });
  });
});
