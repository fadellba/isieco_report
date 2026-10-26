export type UserNotification = {
  idNotification: string;
  titre: string;
  message: string;
  lu: boolean;
  dateCreation: Date;
  lienCible: string | null;
};

export type UserNotifications = {
  count: number;
  nonLues: number;
  data: UserNotification[];
};
