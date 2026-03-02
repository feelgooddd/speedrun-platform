import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

const softDeleteModels = ['Game', 'Platform', 'Category', 'Subcategory'];

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })

const prisma = new PrismaClient({ adapter }).$extends({
  query: {
    $allModels: {
      async findUnique({ model, operation, args, query }) {
        if (softDeleteModels.includes(model)) {
          (args.where as any).deleted_at = null;
        }
        return query(args);
      },
      async findFirst({ model, operation, args, query }) {
        if (softDeleteModels.includes(model)) {
          args.where = { ...args.where, deleted_at: null };
        }
        return query(args);
      },
      async findMany({ model, operation, args, query }) {
        if (softDeleteModels.includes(model)) {
          args.where = { ...args.where, deleted_at: null };
        }
        return query(args);
      },
    },
  },
});

export default prisma