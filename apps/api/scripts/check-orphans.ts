import prisma from '../src/lib/prisma';

async function check() {
  const orphans = await prisma.category.findMany({
    where: { platform_id: null }
  });
  
  console.log(`Categories without platform_id: ${orphans.length}\n`);
  
  for (const cat of orphans) {
    const runCount = await prisma.run.count({ where: { category_id: cat.id } });
    console.log(`- ${cat.name} (${cat.id}): ${runCount} runs`);
  }
  
  if (orphans.length > 0 && orphans.every(c => c)) {
    console.log('\nTo delete orphaned categories with 0 runs:');
    console.log('await prisma.category.deleteMany({ where: { platform_id: null } })');
  }
  
  await prisma.$disconnect();
}

check();