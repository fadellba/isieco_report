import { PrismaClient } from '../../generated/prisma/client.js';
import { UserNotification } from '../../domain/notifications.js';
import { NotificationsRepository } from '../../application/ports/notifications-repository.js';

export class PrismaNotificationsRepository implements NotificationsRepository {
  constructor(private readonly client: PrismaClient) {}

  async listByUser(idUtilisateur: string, limit: number): Promise<UserNotification[]> {
    const notifications = await this.client.notification.findMany({
      where: { idUtilisateur },
      orderBy: { dateCreation: 'desc' },
      take: limit,
      select: {
        idNotification: true,
        titre: true,
        message: true,
        lu: true,
        dateCreation: true,
        lienCible: true,
      },
    });

    return notifications;
  }

  async markAsRead(idNotification: string, idUtilisateur: string): Promise<void> {
    await this.client.notification.updateMany({
      where: { idNotification, idUtilisateur },
      data: { lu: true },
    });
  }
}
