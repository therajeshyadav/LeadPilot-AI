/**
 * Clear stale HOT_LEAD WhatsApp messages
 * Run: npx tsx src/scripts/clear-stale-whatsapp.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearStaleMessages() {
  console.log('🔍 Checking for stale HOT_LEAD WhatsApp messages...');
  
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  // Find stale messages
  const staleMessages = await prisma.whatsAppMessage.findMany({
    where: {
      type: 'HOT_LEAD',
      createdAt: {
        lt: oneHourAgo
      }
    },
    select: {
      id: true,
      leadId: true,
      conversationId: true,
      createdAt: true,
      sentAt: true,
      providerMessageId: true
    }
  });
  
  console.log(`Found ${staleMessages.length} stale HOT_LEAD messages (older than 1 hour)`);
  
  if (staleMessages.length > 0) {
    console.log('Stale messages:', staleMessages);
    
    const deleted = await prisma.whatsAppMessage.deleteMany({
      where: {
        type: 'HOT_LEAD',
        createdAt: {
          lt: oneHourAgo
        }
      }
    });
    
    console.log(`✅ Deleted ${deleted.count} stale HOT_LEAD messages`);
  } else {
    console.log('✅ No stale messages found');
  }
  
  await prisma.$disconnect();
}

clearStaleMessages().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
