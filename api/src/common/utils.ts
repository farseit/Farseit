import { BadRequestException } from '@nestjs/common';
import { GraphQLScalarType, Kind } from 'graphql';
import { GraphQLJSON } from 'graphql-type-json';

export const DateTimeScalar = new GraphQLScalarType({
  name: 'DateTime',
  serialize: (v: any) => (v instanceof Date ? v.toISOString() : new Date(v).toISOString()),
  parseValue: (v: any) => new Date(v),
  parseLiteral: (ast) => (ast.kind === Kind.STRING ? new Date(ast.value) : null),
});

export const scalarResolvers = { JSON: GraphQLJSON, DateTime: DateTimeScalar };

export const slugify = (s: string) =>
  (s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';

export function normalizePhone(p: string): string {
  let n = (p || '').replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d))).replace(/\D/g, '');
  if (n.startsWith('880')) n = '0' + n.slice(3);
  if (!/^01[3-9]\d{8}$/.test(n)) {
    throw new BadRequestException('Enter a valid Bangladeshi mobile number (01XXXXXXXXX)');
  }
  return n;
}
