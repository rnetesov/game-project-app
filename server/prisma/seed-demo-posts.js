import bcrypt from 'bcryptjs';
import { prisma } from '../src/config/prisma.js';

// All demo accounts use this password. Change it before exposing a demo instance publicly.
export const DEMO_PASSWORD = 'GameHubDemo2026!';

const demoUsers = [
  { username: 'pixel_ranger', email: 'pixel.ranger@gamehub.test', bio: 'Люблю сюжетные шутеры, исследование миров и атмосферные саундтреки.', level: 18, xp: 740, avatar: 12 },
  { username: 'neon_fox', email: 'neon.fox@gamehub.test', bio: 'Киберпанк, кооператив и ночные игровые сессии.', level: 24, xp: 1280, avatar: 32 },
  { username: 'vortex', email: 'vortex@gamehub.test', bio: 'Тактика прежде всего. Ищу команду для сложных миссий.', level: 31, xp: 2150, avatar: 8 },
  { username: 'luna_bytes', email: 'luna.bytes@gamehub.test', bio: 'Инди-игры, RPG и красивые игровые миры.', level: 15, xp: 510, avatar: 47 },
  { username: 'iron_mantis', email: 'iron.mantis@gamehub.test', bio: 'Люблю сложные боссы и честные испытания.', level: 27, xp: 1640, avatar: 14 },
  { username: 'zero_cool', email: 'zero.cool@gamehub.test', bio: 'Скорость, киберспорт и точная стрельба.', level: 22, xp: 990, avatar: 5 },
  { username: 'starling', email: 'starling@gamehub.test', bio: 'Фотографирую виртуальные пейзажи и собираю секреты.', level: 12, xp: 320, avatar: 20 },
  { username: 'ghost_protocol', email: 'ghost.protocol@gamehub.test', bio: 'Стелс — мой любимый способ решать проблемы.', level: 35, xp: 2860, avatar: 11 },
  { username: 'red_comet', email: 'red.comet@gamehub.test', bio: 'Гонки, экшен и немного хаоса.', level: 19, xp: 810, avatar: 3 },
  { username: 'mira_play', email: 'mira.play@gamehub.test', bio: 'Играю ради историй, персонажей и хорошей компании.', level: 9, xp: 180, avatar: 44 },
  { username: 'byte_knight', email: 'byte.knight@gamehub.test', bio: 'Люблю RPG, билды и теории о лоре.', level: 29, xp: 1920, avatar: 16 },
  { username: 'quietstorm', email: 'quietstorm@gamehub.test', bio: 'Тактические игры и спокойные кооперативные вечера.', level: 16, xp: 620, avatar: 25 },
  { username: 'drift_king', email: 'drift.king@gamehub.test', bio: 'В поворот нужно входить красиво.', level: 21, xp: 930, avatar: 9 },
  { username: 'pixelwitch', email: 'pixelwitch@gamehub.test', bio: 'Магия, приключения и немного пиксельной ностальгии.', level: 14, xp: 430, avatar: 36 },
  { username: 'atlas_run', email: 'atlas.run@gamehub.test', bio: 'Исследую каждый угол карты. Быстро пройти — не моя цель.', level: 26, xp: 1510, avatar: 18 },
  { username: 'night_owl', email: 'night.owl@gamehub.test', bio: 'По ночам тестирую новые игры и делюсь впечатлениями.', level: 11, xp: 270, avatar: 29 }
];

const demoPosts = [
  { author: 'pixel_ranger', days: 0.2, content: 'Всем привет! Запускаю этот профиль с вопроса: какая одиночная игра в последний раз заставила вас забыть о времени? Мне недавно это удалось благодаря отличной научно-фантастической кампании.' },
  { author: 'neon_fox', days: 0.4, content: 'Вечерний город, неоновые вывески и дождь в отражениях асфальта. Иногда хочется запускать игру просто ради атмосферы, а не ради прохождения заданий.' },
  { author: 'vortex', days: 0.7, content: 'Небольшой совет для командных режимов: перед началом матча договоритесь хотя бы о простом плане. Даже две короткие фразы в голосовом чате могут изменить весь раунд.' },
  { author: 'luna_bytes', days: 1.0, content: 'Посоветуйте уютную игру на выходные. Хочется исследовать мир, собирать вещи, знакомиться с персонажами — без постоянной гонки за таймерами.' },
  { author: 'iron_mantis', days: 1.3, content: 'Сегодня победил босса, на котором застрял вчера. Никакого случайного везения: наконец-то выучил комбинации атак. Это одна из лучших сторон сложных игр.' },
  { author: 'zero_cool', days: 1.7, content: 'Поменял чувствительность мыши и потренировался на полигоне. Результат заметен сразу. Не всегда проблема в реакции — иногда просто нужно настроить управление под себя.' },
  { author: 'starling', days: 2.0, content: 'Сделал небольшую подборку любимых игровых видов сверху на горы. Виртуальные миры иногда дарят отличные пейзажи. Какую локацию вы бы назвали самой красивой?' },
  { author: 'ghost_protocol', days: 2.4, content: 'Прошёл миссию без единого поднятого тревожного сигнала. Стелс заставляет смотреть на карту совсем иначе: маршруты патрулей становятся почти головоломкой.' },
  { author: 'red_comet', days: 2.8, content: 'В гонках важна не только максимальная скорость. Чистая траектория и правильный выход из поворота часто дают больше, чем попытка тормозить как можно позже.' },
  { author: 'mira_play', days: 3.1, content: 'Я всегда читаю записки и дополнительные диалоги. Иногда маленькая история второстепенного персонажа запоминается сильнее основной сюжетной линии.' },
  { author: 'byte_knight', days: 3.5, content: 'В RPG вы тоже проводите полчаса в меню талантов, чтобы собрать идеальный билд, а потом проходите половину игры с одним и тем же любимым умением?' },
  { author: 'quietstorm', days: 3.9, content: 'Ищу напарников для кооператива. Предпочитаю общение без токсичности, командную работу и возможность спокойно исследовать игру.' },
  { author: 'drift_king', days: 4.2, content: 'Сегодня устроили дружеский заезд. Самое весёлое — не таблица результатов, а истории о том, как кто-то случайно нашёл короткий путь через декорации.' },
  { author: 'pixelwitch', days: 4.6, content: 'У старых пиксельных игр есть особое очарование. Ограничения графики иногда заставляли разработчиков придумывать очень выразительные визуальные решения.' },
  { author: 'atlas_run', days: 5.0, content: 'Мой стиль прохождения: сначала исследовать все ответвления, потом выполнять основное задание. Да, иногда сюжет ждёт меня несколько часов.' },
  { author: 'night_owl', days: 5.4, content: 'Как вы выбираете следующую игру? По рекомендациям друзей, обзорам, трейлерам или просто открываете библиотеку и выбираете наугад?' },
  { author: 'neon_fox', days: 5.8, content: 'Люблю, когда окружение рассказывает историю без длинных диалогов: разбросанные предметы, свет в окнах, следы недавних событий. Детали работают.' },
  { author: 'vortex', days: 6.2, content: 'После нескольких матчей понял, что стабильная командная коммуникация полезнее идеальной статистики каждого игрока. Хорошая команда умеет поддерживать друг друга.' },
  { author: 'luna_bytes', days: 6.7, content: 'В последнее время стараюсь не пропускать титры. За каждой игрой стоит большая команда людей, и приятно увидеть, сколько специалистов работало над результатом.' },
  { author: 'iron_mantis', days: 7.1, content: 'Какой тип испытаний вам нравится больше: сложные боссы, головоломки, выживание с ограниченными ресурсами или задания на время?' },
  { author: 'zero_cool', days: 7.6, content: 'Собрал небольшой список игр, в которых обучение не затягивается на час, а постепенно вводит новые механики. Люблю, когда игра уважает время игрока.' },
  { author: 'starling', days: 8.0, content: 'Иногда лучший игровой момент невозможно запланировать: случайная встреча, забавный физический баг или неожиданный красивый закат.' },
  { author: 'ghost_protocol', days: 8.5, content: 'Повторил знакомую миссию другим маршрутом и нашёл целую комнату, которую раньше пропускал. Хороший уровень всегда вознаграждает любопытство.' },
  { author: 'red_comet', days: 9.0, content: 'Нужна рекомендация аркадных гонок с приятным чувством скорости и возможностью немного настроить автомобили. Что сейчас стоит попробовать?' },
  { author: 'mira_play', days: 9.5, content: 'Небольшое напоминание: не превращайте игры в список обязательных дел. Иногда можно просто побегать по любимому миру и отдохнуть.' },
  { author: 'byte_knight', days: 10.0, content: 'Что для вас важнее в RPG: интересная система развития, сильные персонажи или возможность влиять на ход истории? Для меня важен баланс всех трёх.' },
  { author: 'quietstorm', days: 10.5, content: 'Сыграли кооперативную миссию почти без слов — все понимали задачи по движениям команды. Отличное чувство синхронности!' },
  { author: 'drift_king', days: 11.0, content: 'Пробую разные настройки камеры в гонках. Вид из кабины даёт больше погружения, но с внешней камерой проще оценивать положение машины.' },
  { author: 'pixelwitch', days: 11.5, content: 'Какая игровая музыка у вас остаётся в плейлисте даже после прохождения? Иногда саундтрек становится отдельным воспоминанием об игре.' },
  { author: 'atlas_run', days: 12.0, content: 'Нашёл секретную комнату за неприметной стеной. Обожаю моменты, когда внимательность вознаграждается без огромной подсказки на экране.' },
  { author: 'night_owl', days: 12.5, content: 'Давайте знакомиться: напишите, в какие жанры играете чаще всего и что сейчас установлено у вас на компьютере. Может, найдём общие игры.' },
  { author: 'pixel_ranger', days: 13.0, content: 'Спасибо всем за советы в комментариях! Уже добавил несколько игр в список желаемого. GameHub постепенно наполняется жизнью — продолжайте делиться впечатлениями.' }
];

const commentTemplates = [
  'Полностью согласен! Особенно нравится, когда игра даёт пространство для собственного подхода.',
  'Хорошая мысль. Добавил себе в список, спасибо за рекомендацию!',
  'У меня похожие впечатления. Такие детали действительно делают игровой процесс интереснее.',
  'А можешь посоветовать ещё пару игр в таком духе?',
  'Вот ради таких моментов и люблю игры. Никогда не знаешь, чем закончится сессия.',
  'Интересно, я обычно поступаю наоборот. Надо будет попробовать твой вариант.',
  'Поддерживаю! Хорошая атмосфера иногда важнее количества механик.',
  'Звучит здорово. Было бы интересно сыграть вместе.'
];

const acceptedFriendPairs = [
  ['pixel_ranger', 'neon_fox'], ['pixel_ranger', 'luna_bytes'],
  ['vortex', 'ghost_protocol'], ['vortex', 'quietstorm'],
  ['iron_mantis', 'byte_knight'], ['zero_cool', 'red_comet'],
  ['starling', 'atlas_run'], ['mira_play', 'pixelwitch'],
  ['neon_fox', 'drift_king'], ['luna_bytes', 'starling'],
  ['quietstorm', 'night_owl'], ['byte_knight', 'pixelwitch'],
  ['red_comet', 'atlas_run'], ['ghost_protocol', 'iron_mantis']
];

const pendingFriendPairs = [
  ['night_owl', 'pixel_ranger'], ['drift_king', 'vortex'],
  ['mira_play', 'neon_fox'], ['starling', 'zero_cool']
];

const hoursAgo = (hours) => new Date(Date.now() - hours * 60 * 60 * 1000);

async function seedUsers() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const usersByName = new Map();

  for (const [index, user] of demoUsers.entries()) {
    const saved = await prisma.user.upsert({
      where: { username: user.username },
      update: {
        email: user.email,
        bio: user.bio,
        avatarUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=' + encodeURIComponent(user.username),
        level: user.level,
        xp: user.xp
      },
      create: {
        username: user.username,
        email: user.email,
        passwordHash,
        bio: user.bio,
        avatarUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=' + encodeURIComponent(user.username),
        level: user.level,
        xp: user.xp,
        lastSeenAt: hoursAgo(3 + index * 2),
        createdAt: hoursAgo(24 * (35 + index * 3))
      }
    });
    usersByName.set(user.username, saved);
  }

  return usersByName;
}

async function seedPosts(usersByName) {
  const postsByIndex = [];

  for (const post of demoPosts) {
    const author = usersByName.get(post.author);
    const createdAt = new Date(Date.now() - post.days * 24 * 60 * 60 * 1000);
    let saved = await prisma.post.findFirst({
      where: { authorId: author.id, content: post.content },
      select: { id: true, authorId: true, content: true, createdAt: true }
    });

    if (!saved) {
      saved = await prisma.post.create({
        data: { authorId: author.id, content: post.content, createdAt },
        select: { id: true, authorId: true, content: true, createdAt: true }
      });
    }
    postsByIndex.push(saved);
  }

  return postsByIndex;
}

async function seedComments(posts, usersByName) {
  const commentsToCreate = [];
  const postIds = posts.map(post => post.id);
  const existing = await prisma.comment.findMany({
    where: { postId: { in: postIds } },
    select: { postId: true, authorId: true, content: true }
  });
  const existingKeys = new Set(existing.map(item => item.postId + '|' + item.authorId + '|' + item.content));

  posts.forEach((post, index) => {
    const firstAuthor = usersByName.get(demoUsers[(index + 3) % demoUsers.length].username);
    const secondAuthor = usersByName.get(demoUsers[(index + 7) % demoUsers.length].username);
    const rows = [
      { author: firstAuthor, content: commentTemplates[index % commentTemplates.length], minutes: 18 + index },
      { author: secondAuthor, content: commentTemplates[(index + 3) % commentTemplates.length], minutes: 51 + index }
    ];

    for (const row of rows) {
      if (row.author.id === post.authorId) continue;
      const key = post.id + '|' + row.author.id + '|' + row.content;
      if (existingKeys.has(key)) continue;
      existingKeys.add(key);
      commentsToCreate.push({
        postId: post.id,
        authorId: row.author.id,
        content: row.content,
        createdAt: new Date(post.createdAt.getTime() + row.minutes * 60 * 1000)
      });
    }
  });

  if (commentsToCreate.length) await prisma.comment.createMany({ data: commentsToCreate });
  return commentsToCreate.length;
}

async function seedLikes(posts, usersByName) {
  const userList = demoUsers.map(user => usersByName.get(user.username));
  const postIds = posts.map(post => post.id);
  const existing = await prisma.postLike.findMany({
    where: { postId: { in: postIds } },
    select: { postId: true, userId: true }
  });
  const existingKeys = new Set(existing.map(item => item.postId + '|' + item.userId));
  const likesToCreate = [];

  posts.forEach((post, index) => {
    const desiredCount = 4 + (index % 7);
    let addedForPost = 0;
    let offset = 1;

    while (addedForPost < desiredCount && offset <= userList.length * 2) {
      const user = userList[(index * 3 + offset) % userList.length];
      offset += 1;
      if (user.id === post.authorId) continue;
      const key = post.id + '|' + user.id;
      if (existingKeys.has(key)) continue;
      existingKeys.add(key);
      likesToCreate.push({
        postId: post.id,
        userId: user.id,
        createdAt: new Date(post.createdAt.getTime() + (offset * 4) * 60 * 1000)
      });
      addedForPost += 1;
    }
  });

  if (likesToCreate.length) await prisma.postLike.createMany({ data: likesToCreate });
  return likesToCreate.length;
}

async function seedFriendRequests(usersByName) {
  let created = 0;
  const pairs = [
    ...acceptedFriendPairs.map(([sender, receiver]) => ({ sender, receiver, status: 'ACCEPTED' })),
    ...pendingFriendPairs.map(([sender, receiver]) => ({ sender, receiver, status: 'PENDING' }))
  ];

  for (const pair of pairs) {
    const sender = usersByName.get(pair.sender);
    const receiver = usersByName.get(pair.receiver);
    const existing = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { senderId: sender.id, receiverId: receiver.id },
          { senderId: receiver.id, receiverId: sender.id }
        ]
      },
      select: { id: true }
    });
    if (existing) continue;

    await prisma.friendRequest.create({
      data: {
        senderId: sender.id,
        receiverId: receiver.id,
        status: pair.status,
        createdAt: hoursAgo(12 + created * 5)
      }
    });
    created += 1;
  }
  return created;
}

async function main() {
  console.log('Создаём демонстрационные аккаунты...');
  const usersByName = await seedUsers();
  console.log('Создаём публикации...');
  const posts = await seedPosts(usersByName);
  console.log('Добавляем комментарии, лайки и связи...');
  const commentsCreated = await seedComments(posts, usersByName);
  const likesCreated = await seedLikes(posts, usersByName);
  const friendsCreated = await seedFriendRequests(usersByName);

  console.log('\nДемо-данные GameHub готовы:');
  console.log('Пользователей: ' + usersByName.size);
  console.log('Публикаций: ' + posts.length);
  console.log('Новых комментариев: ' + commentsCreated);
  console.log('Новых лайков: ' + likesCreated);
  console.log('Новых связей/заявок в друзья: ' + friendsCreated);
  console.log('\nОбщий пароль демо-аккаунтов: ' + DEMO_PASSWORD);
  console.log('Логин: любой username из списка демо-пользователей.');
}

main()
  .catch(error => {
    console.error('Не удалось заполнить демо-данные:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
