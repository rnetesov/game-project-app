import path from 'node:path';
import { fileURLToPath } from 'node:url';

const configDirectory = path.dirname(fileURLToPath(import.meta.url));
export const uploadsDirectory = path.resolve(configDirectory, '../../uploads');
export const postImagesDirectory = path.join(uploadsDirectory, 'post-images');

export const gameCoversDirectory = path.join(uploadsDirectory, 'game-covers');

export const messageAttachmentsDirectory = path.resolve(configDirectory, '../../private-uploads/message-attachments');
