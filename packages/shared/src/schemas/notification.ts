import { z } from 'zod';

export const NotificationSchema = z.object({
  idNotification: z.string().uuid(),
  idUtilisateur: z.string().uuid(),
  titre: z.string().min(1),
  message: z.string().min(1),
  lu: z.boolean().default(false),
  dateCreation: z.string(),
  lienCible: z.string().nullable().optional(),
});

export type Notification = z.infer<typeof NotificationSchema>;

