import { NotificationsRepository } from '../ports/notifications-repository.js';
import { UserNotifications } from '../../domain/notifications.js';

const MAX_NOTIFICATIONS = 50;

export async function getUserNotifications(
  repository: NotificationsRepository,
  idUtilisateur: string,
): Promise<UserNotifications> {
  const data = await repository.listByUser(idUtilisateur, MAX_NOTIFICATIONS);

  return {
    count: data.length,
    nonLues: data.filter((notification) => !notification.lu).length,
    data,
  };
}

export async function markUserNotificationAsRead(
  repository: NotificationsRepository,
  idNotification: string,
  idUtilisateur: string,
): Promise<void> {
  await repository.markAsRead(idNotification, idUtilisateur);
}
