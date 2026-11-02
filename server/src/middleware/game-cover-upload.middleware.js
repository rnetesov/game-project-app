import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { gameCoversDirectory } from '../config/upload-paths.js';

const MAX_COVER_SIZE = 5 * 1024 * 1024;
const MAX_REQUEST_SIZE = MAX_COVER_SIZE + 64 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const HEADER_SEPARATOR = Buffer.from('\r\n\r\n');

function uploadError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function detectImage(buffer) {
  if (buffer.length >= 8
    && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mimeType: 'image/png', extension: '.png' };
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mimeType: 'image/jpeg', extension: '.jpg' };
  }
  if (buffer.length >= 12
    && buffer.toString('ascii', 0, 4) === 'RIFF'
    && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return { mimeType: 'image/webp', extension: '.webp' };
  }
  const signature = buffer.toString('ascii', 0, 6);
  if (signature === 'GIF87a' || signature === 'GIF89a') {
    return { mimeType: 'image/gif', extension: '.gif' };
  }
  return null;
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
        reject(uploadError('Обложка слишком большая. Максимум 5 МБ.', 413));
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

function parseHeaders(rawHeaders) {
  const headers = {};
  for (const line of rawHeaders.split('\r\n')) {
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    headers[line.slice(0, separator).trim().toLowerCase()] = line.slice(separator + 1).trim();
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
    throw uploadError('Некорректный формат загрузки обложки');
  }
  position = marker.length;

  while (position < body.length) {
    if (body.subarray(position, position + 2).toString() === '--') break;
    if (body.subarray(position, position + 2).toString() !== '\r\n') {
      throw uploadError('Некорректная структура загружаемых данных');
    }
    position += 2;

    const headerEnd = body.indexOf(HEADER_SEPARATOR, position);
    if (headerEnd === -1) throw uploadError('Не удалось прочитать заголовки файла');
    const headers = parseHeaders(body.toString('utf8', position, headerEnd));
    const partStart = headerEnd + HEADER_SEPARATOR.length;
    const nextBoundary = body.indexOf(delimiter, partStart);
    if (nextBoundary === -1) throw uploadError('Загрузка обложки завершилась некорректно');

    parts.push({ headers, data: body.subarray(partStart, nextBoundary) });
    position = nextBoundary + delimiter.length;
  }
  return parts;
}

async function removeFile(file) {
  if (file?.path) await unlink(file.path).catch(() => {});
}

export async function parseGameCoverMultipart(req, res, next) {
  const contentType = req.headers['content-type'] || '';
  if (!contentType.toLowerCase().startsWith('multipart/form-data')) return next();

  const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundaryValue = (boundary?.[1] || boundary?.[2] || '').trim();
  if (!boundaryValue || boundaryValue.length > 70) {
    return res.status(400).json({ success: false, message: 'Некорректный формат загрузки обложки' });
  }

  let savedFile = null;
  try {
    const body = await readRequestBody(req);
    const parts = extractParts(body, boundaryValue);
    req.body = {};

    for (const part of parts) {
      const disposition = parseDisposition(part.headers['content-disposition']);
      if (!disposition.name) throw uploadError('Не удалось определить поле формы');

      if (disposition.filename !== null && disposition.filename !== '') {
        if (disposition.name !== 'cover') throw uploadError('Неизвестное поле для файла');
        if (savedFile) throw uploadError('Можно загрузить только одну обложку');
        if (part.data.length === 0) continue;
        if (part.data.length > MAX_COVER_SIZE) {
          throw uploadError('Размер обложки не должен превышать 5 МБ', 413);
        }

        const declaredMime = (part.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
        if (!ALLOWED_MIME_TYPES.has(declaredMime)) {
          throw uploadError('Поддерживаются только JPG, PNG, WEBP и GIF');
        }
        const detected = detectImage(part.data);
        if (!detected || detected.mimeType !== declaredMime) {
          throw uploadError('Файл не похож на изображение заявленного формата');
        }

        await mkdir(gameCoversDirectory, { recursive: true });
        const filename = randomUUID() + detected.extension;
        const filePath = path.join(gameCoversDirectory, filename);
        await writeFile(filePath, part.data, { flag: 'wx' });
        savedFile = {
          filename,
          path: filePath,
          url: '/uploads/game-covers/' + filename,
        };
      } else {
        const allowedFields = ['title', 'description', 'genre', 'subGenre', 'platforms', 'releaseYear'];
        if (!allowedFields.includes(disposition.name)) {
          throw uploadError('Неизвестное поле формы');
        }
        if (Object.prototype.hasOwnProperty.call(req.body, disposition.name)) {
          throw uploadError('Поле формы передано несколько раз');
        }
        req.body[disposition.name] = part.data.toString('utf8');
      }
    }

    req.file = savedFile;
    next();
  } catch (error) {
    await removeFile(savedFile);
    res.status(error.status || 400).json({
      success: false,
      message: error.message || 'Не удалось загрузить обложку',
    });
  }
}

export async function removeGameCoverFile(file) {
  await removeFile(file);
}
