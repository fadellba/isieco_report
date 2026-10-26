import { UserNotification } from '../../domain/notifications.js';

export interface NotificationsRepository {
  listByUser(idUtilisateur: string, limit: number): Promise<UserNotification[]>;
  markAsRead(idNotification: string, idUtilisateur: string): Promise<void>;
}
