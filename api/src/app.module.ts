import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { join } from 'path';
import { AuthModule } from './auth/auth.module';
import { scalarResolvers } from './common/utils';
import { HealthController } from './common/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { PushModule } from './push/push.module';
import { ShopModule } from './shop/shop.module';
import { UploadModule } from './upload/upload.module';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      typePaths: [join(process.cwd(), 'src/**/*.graphql')],
      resolvers: scalarResolvers,
      context: ({ req, res }) => ({ req, res }),
      introspection: process.env.NODE_ENV !== 'production',
      playground: false,
    }),
    PrismaModule,
    AuthModule,
    PushModule,
    UploadModule,
    ShopModule,
  ],
})
export class AppModule {}
