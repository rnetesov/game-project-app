import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { messageAttachmentsDirectory } from '../config/upload-paths.js';

export const MAX_MESSAGE_FILES = 5;
export const MAX_MESSAGE_FILE_SIZE = 10 * 1024 * 1024;
const MAX_REQUEST_SIZE = 25 * 1024 * 1024 + 256 * 1024;
const HEADER_SEPARATOR = Buffer.from('\r\n\r\n');

const ALLOWED_TYPES = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
  ['application/pdf', '.pdf'],
  ['text/plain', '.txt'],
  ['application/zip', '.zip'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.docx'],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.xlsx'],
  ['application/vnd.openxmlformats-officedocument.presentationml.presentation', '.pptx'],
]);

function uploadError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function parseHeaders(rawHeaders) {
  const headers = {};
  for (const line of rawHeaders.split('\r\n')) {
    const separator = line.indexOf(':');
    if (separator !== -1) {
      headers[line.slice(0, separator).trim().toLowerCase()] = line.slice(separator + 1).trim();
    }
  }
  return headers;
}

function parseDisposition(value = '') {
  const name = value.match(/(?:^|;)\s*name="([^"]*)"/i)?.[1];
  const filenameMatch = value.match(/(?:^|;)\s*filename="([^"]*)"/i);
  return { name, filename: filenameMatch ? filenameMatch[1] : null };
}

function extractParts(body, boundary) {
  const marker = Buffer.from('--' + boundary);
  const delimiter = Buffer.from('\r\n--' + boundary);
  let position = 0;
  const parts = [];

  if (!body.subarray(0, marker.length).equals(marker)) {
    throw uploadError('Некорректный формат вложений');
  }
  position = marker.length;

  while (position < body.length) {
    if (body.subarray(position, position + 2).toString() === '--') break;
    if (body.subarray(position, position + 2).toString() !== '\r\n') {
      throw uploadError('Некорректная структура вложений');
    }
    position += 2;
    const headerEnd = body.indexOf(HEADER_SEPARATOR, position);
    if (headerEnd === -1) throw uploadError('Не удалось прочитать данные вложения');
    const headers = parseHeaders(body.toString('utf8', position, headerEnd));
    const partStart = headerEnd + HEADER_SEPARATOR.length;
    const nextBoundary = body.indexOf(delimiter, partStart);
    if (nextBoundary === -1) throw uploadError('Загрузка вложения завершилась некорректно');
    parts.push({ headers, data: body.subarray(partStart, nextBoundary) });
    position = nextBoundary + delimiter.length;
  }
  return parts;
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    let settled = false;
    req.on('data', chunk => {
      if (settled) return;
      total += chunk.length;
      if (total > MAX_REQUEST_SIZE) {
        settled = true;
        reject(uploadError('Суммарный размер вложений не должен превышать 25 МБ', 413));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!settled) resolve(Buffer.concat(chunks, total));
    });
    req.on('error', error => {
      if (!settled) reject(error);
    });
    req.on('aborted', () => {
      if (!settled) reject(uploadError('Загрузка была прервана'));
    });
  });
}

function hasSignature(buffer, mimeType) {
  if (mimeType === 'image/png') return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === 'image/jpeg') return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === 'image/webp') return buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  if (mimeType === 'image/gif') return ['GIF87a', 'GIF89a'].includes(buffer.toString('ascii', 0, 6));
  if (mimeType === 'application/pdf') return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  if (mimeType === 'application/zip' || mimeType.startsWith('application/vnd.openxmlformats-officedocument.')) {
    return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && [0x03, 0x05, 0x07].includes(buffer[2]);
  }
  if (mimeType === 'text/plain') {
    return !buffer.subarray(0, Math.min(buffer.length, 8192)).includes(0);
  }
  return false;
}

function safeOriginalName(value) {
  const basename = path.basename(String(value || 'file').replace(/\\/g, '/'));
  return basename.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 180) || 'file';
}

export async function parseMessageAttachments(req, res, next) {
  const contentType = req.headers['content-type'] || '';
  if (!contentType.toLowerCase().startsWith('multipart/form-data')) return next();

  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundary = (boundaryMatch?.[1] || boundaryMatch?.[2] || '').trim();
  if (!boundary || boundary.length > 70) {
    return res.status(400).json({ success: false, message: 'Некорректный формат вложений' });
  }

  const savedFiles = [];
  try {
    const body = await readRequestBody(req);
    const parts = extractParts(body, boundary);
    req.body = {};
    req.messageFiles = [];

    for (const part of parts) {
      const disposition = parseDisposition(part.headers['content-disposition']);
      if (!disposition.name) throw uploadError('Не удалось определить поле формы');

      if (disposition.filename !== null && disposition.filename !== '') {
        if (disposition.name !== 'attachments') throw uploadError('Неизвестное поле для файла');
        if (req.messageFiles.length >= MAX_MESSAGE_FILES) {
          throw uploadError('Можно отправить не более 5 файлов за одно сообщение');
        }
        if (!part.data.length) continue;
        if (part.data.length > MAX_MESSAGE_FILE_SIZE) {
          throw uploadError('Размер одного файла не должен превышать 10 МБ', 413);
        }

        const mimeType = (part.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
        const extension = ALLOWED_TYPES.get(mimeType);
        if (!extension) {
          throw uploadError('Этот тип файла нельзя отправить. Разрешены изображения, PDF, TXT, ZIP, DOCX, XLSX и PPTX.');
        }
        if (!hasSignature(part.data, mimeType)) {
          throw uploadError('Содержимое файла не соответствует его формату');
        }

        await mkdir(messageAttachmentsDirectory, { recursive: true });
        const storageName = randomUUID() + extension;
        const filePath = path.join(messageAttachmentsDirectory, storageName);
        await writeFile(filePath, part.data, { flag: 'wx' });
        const saved = {
          originalName: safeOriginalName(disposition.filename),
          storageName,
          mimeType,
          size: part.data.length,
          path: filePath,
        };
        req.messageFiles.push(saved);
        savedFiles.push(saved);
      } else {
        if (disposition.name !== 'content') throw uploadError('Неизвестное поле формы');
        if (Object.prototype.hasOwnProperty.call(req.body, 'content')) {
          throw uploadError('Текст сообщения передан несколько раз');
        }
        req.body.content = part.data.toString('utf8');
      }
    }

    req.cleanupMessageFiles = async () => Promise.all(savedFiles.map(file => unlink(file.path).catch(() => {})));
    next();
  } catch (error) {
    await Promise.all(savedFiles.map(file => unlink(file.path).catch(() => {})));
    res.status(error.status || 400).json({
      success: false,
      message: error.message || 'Не удалось загрузить вложения',
    });
  }
}

export async function deleteMessageAttachmentFile(storageName) {
  if (!/^[a-f0-9-]+\.(jpg|png|webp|gif|pdf|txt|zip|docx|xlsx|pptx)$/i.test(storageName)) return;
  const filePath = path.join(messageAttachmentsDirectory, storageName);
  if (path.dirname(filePath) !== messageAttachmentsDirectory) return;
  await unlink(filePath).catch(() => {});
}
