// У вас должен быть установлен nodejs
// Установите зависимости для скрипта командой npm install golos-js
// Постинг ключ аккаунта, который будет делать реблоги
const postingkey = "5XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"



// Фильтр тэгов, "REBLOGGER" будет делать реблог, только если в посте будут указанные тэги
// Массив можно оставить пустым - [], тогда будут учтены любые тэги 
const TAGS = ['ru--fotogolosishche']

// Белый список авторов, постам которых мы будет делать реблог в блог "REBLOGGER"!
// К этому списку будут автоматически добавлены все, на кого будет подписан "accountfilter"!
let blogs = []

// Логин аккаунта который будет делать реблоги в свой блог
const REBLOGGER = "tester"

// Логин аккаунта который должен подписывать на пользователей, что бы их имена попали в белый список!
// Можно оставить пустым, тогда белый список будет браться из переменной выше - "blogs" 
const accountfilter = "goldenriver"

// Текст комментария под постом, которому вы сделали реблог
const COMMENT = `💡 **${REBLOGGER} сделал реблог :)**`

// Заголовок комментария - виден в уведомлениях и при приямой ссылке на комментарий
const TITLE = "Тест работы реблоггера"

// Вес голоса за пост которому вы сделали реблог. 100% = 10000 , 50% = 5000 и т.д.
const VOTEPOWER = 10000



// Если у вас не установлена локальная нода, адрес следует изменить на адрес публичной ноды. 
// Например "wss://api.golos.cf" - нода @vik 
const GOLOSNODE = "ws://localhost:9090"

// =================== Ниже не редактируем! =========================


// Подключение JavaScript библиотеки для работы c API голоса
const golos = require('golos-js')

// Указываем ноду, к которой будет подключен скрипт
golos.config.set('websocket', GOLOSNODE)

// Глобальная переменная в которой будут хранится все ссылки на реблоги из блока Аккаунта, для дальнейшей сверки
// с постами. Это нужно для исключения из процесса реблогинга старых постов, которым аккаунт уже сделал реблог ранее
let urls = []

console.log(`\x1b[36m========================================= Reblogger =========================================\x1b[0m

✔ Избранные теги:
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
${TAGS}

✔️ Загрузка белого списка пользователей:
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
`)

// Если задан аккаунт для формирования белого списка из подписок выполним следующее:
if (accountfilter) {

    // Узнаем на какое количество пользователей подписан аккаунт-фильтр
    golos.api.getFollowCount(accountfilter, (err, count) => {

        // Если запрос не удался - прервем работу с ошибкой
        if (err) return console.warn(err)

        // Зададим пустую переменную вне цикла
        let last = null

        // Создадим функцию c передаваемым параметром lastname для цикла запросов всех на кого подписался аккаунт-фильтр 

        const getfollowings = (lastname) => {

            // Запрашиваем список подписок 
            // Параметр blog - указывает на подписки. Если указать вместо этого параметр ignore - получим тех, кого аккаунт-фильтр добавил в игнор
            // У запроса getFollowing в отличии от getFollowers лимит всего в 100 пользователей, а не 1000. Но если мы запомним последнее имя lastname мы сможем
            // Вызыать getFollowing снова указав стартовое имя. Таким образом циклами по 100 имен мы можем получить список любого количества подписок без лимита

            golos.api.getFollowing(accountfilter, lastname, "blog", 100, (errs, followings) => {
                // Если ошибка - выведем лог в консоль и прервем работу			
                if (errs) return console.warn(errs)

                // Если переменая last (есть выше, пока пустая) будет равна имени последнего пользователя из сотни запрошенных
                // В очередном цикле, значит все подписки обработаны и запускаем следующую функцию checkReblogs
                if (last === followings[followings.length - 1].following) {
                    console.log(`
${blogs}

\x1b[36m🔵 Проверяем последние 100 постов
Учтены выбранные вами теги и список пользователей на которых подписан аккаунт-фильтр ${accountfilter} (Если задан в настройках)\x1b[0m

Поиск 🔎 ...
`)
                    return checkReblogs("", "")
                }

                // IF условие выше сработает только если подписок больше нет
                // Если подписки есть, то они будут сохраняться в массив blogs
                // Для этого запустим петлю for of и запишем массив blogs каждого на кого подписался аккаунт-фильтр
                for (let z of followings) blogs.push(z.following)

                // Каждый раз вызавая новую сотню имен - будем записывать последнее имя в переменную last
                last = followings[followings.length - 1].following

                // Когда очередная сотня обработана , запросим следующую сделав отправным именем для запроса последнее имя из переменной last
                getfollowings(last)

            })
        }

        // Это первый запуск функции getfollowings, переменная last в нем еще пустая
        getfollowings(last)
    })


    // Если аккаунт-фильтр не задан, то просто запустим функцию checkReblogs  
} else {
    checkReblogs("", "")
}



// Создаем функцию checkReblogs с возможностью передавать в нее при запуске две переменные lastauthor,lastpermlink

let checkReblogs = (lastauthor, lastpermlink) => {

    // Создадим параметры для запроса к api в котором укажем переменные с аккаунтом реблогера, выбранными тегами, максимальным для этого запроса лимитом - 100
    // А так же стартового автора и стартовую ссылку поста
    let query = {
        "select_authors": [REBLOGGER],
        "select_tags": TAGS,
        "limit": 100,
        "start_author": lastauthor,
        "start_permlink": lastpermlink
    }



    // Теперь отправляем запрос с указанными парамертами используя API вызов getDiscussionsByBlog
    // Это позволит получить нам до 100 записей из блогов  select_authors в которых есть select_tags начиная с start_author и start_permlink
    // start_author и start_permlink пока что пустые и запрос нам выдаст последние 100 постов. Что бы получить 101 и так далее посты, мы будем шагать циклами по 100
    // Каждый раз указывая start_author и start_permlink последнего автора и ссылку из прошлого запроса

    golos.api.getDiscussionsByBlog(query, (e, blogposts) => {
        if (e) return console.warn(e)
        console.log(`
		\x1b[1m\x1b[42m\x1b[37m-----------------------------------------------------------\x1b[0m
		`)
        // Если в блоге реблоггера нет постов и реблогов - сразу вызовем функция реблогинга
        if (!blogposts[0]) return reblog(blogs)

        // А иначе будет проверять и запоминать содержимое блога

        // Зададим переменную "c" c нулем	
        let c = 0
        // Создадим петлю при каждом цикле которой мы будем получать данные одного отдельного поста и сохранять их в переменную "u"
        for (u of blogposts) {

            // Мы возмем данные поста url и будем добавлять их в массив urls
            urls.push(u.url)

            // *Ниже за пределами функции есть переменная с плюсами "c++" - это увеличивает значение в ней на 1 при каждом витке
            // Это помогает считать количество ссылок, которые мы сохранили в urls
            // Ниже условие if помогает нам реагировать на то, когда наш "с" будет равна последней ссылке.
            // Это будет значить, что мы обработали очередную порцию ссылок из нашего лимитированного запроса (лимит был 100)
            if (c === blogposts.length - 1) {

                // **Пропустите вглядом строки ниже до функции checkReblogs(u.author,u.permlink)
                // С ее помощью мы рекурсивно запускаем снова функцию checkReblogs на этот раз передав в нее последнее имя и ссылку автора
                // И следующий виток в 100 ссылок будет начинать уже с последнего автора и ссылки в прошлом витке
                // Таким образом мы можем просмотреть все ссылки в блоге аккаунта реблоггера не смотря на лимит в 100 постов.

                // Чтобы определить когда мы достигнем последнего поста и перестать прервать бесконечный цикл checkReblogs мы проверим,
                //  когда последние ссылка и автор последнего запроса будет такие же как и первые автор и ссылка следующего запроса

                if (lastauthor + lastpermlink === u.author + u.permlink) {

                    // Если они равны - стало быть мы просмотрели весь блог и можно приступать к следующей функции. reblog(blogs)
                    // В переменной blogs мы передали список логинов из белого списка посты которых подлежат реблогам
                    reblog(blogs)

                    // Не забываем остановить отслужившую нам функцию checkReblogs с помощью return
                    return console.log(`\x1b[1m✔️ Список прошлых реблогов ${REBLOGGER} сохранен. 
\x1b[34m🕑 🔎 Поиск новых постов для реблога\x1b[0m
\x1b[37m  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\x1b[0m
`)
                    
                }


                // **Запуск checkReblogs описанный ранее
                checkReblogs(u.author, u.permlink)
            }
            // Увеличение на +1 (*Было описано ранее)
            c++
        }

    })

}




// Описание функции которую мы вызвали из функции выше.
// В переменную users мы записали содердимое переменной blogs --- reblog(blogs)
const reblog = users => {

    // Делаем знакомый запрос на получение постов
    // Но теперь select_authors у нас содержит всех users и мы получим 100 последних постов авторы которых есть в списке users и в которых есть тег из указанного тега TAGS 	
    golos.api.getDiscussionsByBlog({
        "select_authors": users,
        "select_tags": TAGS,
        "limit": 100
    }, (err, blog) => {
        if (err) return console.log(err)

        // Создаем глобальную переменную с нулем, это пригодится нам в будущем для учета количества репостов и формирования отсрочки комментария
        let count = 0
        console.log(blog.length)

        // Создаем цикл для обработки каждого поста из полученной сотни
        for (post of blog) {
            const author = post.author
            const permlink = post.permlink
            const title = post.title
            const link = post.url

            // Проверяем есть ли ссылка текущего поста в блоге реблоггера. 


            if (urls.includes(link)) {
                // Если ссылка есть - стало быть мы уже делали реблог, в этом случае не будет ничего делать
                console.log(`\x1b[33m⚠️ [Реблог уже есть][${author}] ${title}\x1b[0m`)

                //  Если же ссылки нет, тогда будет делать реблог с помощью кода ниже
            } else {

                // Сначала запишем немного JSON который будет отправлять в ноду, что бы сделать реблог
                // Мы расставим переменные так, что бы в json был аккаунт реблогера + логин и ссылка на пост которому нужно сделать реблог.
                const json = JSON.stringify(
                    ["reblog", {
                        account: REBLOGGER,
                        author: author,
                        permlink: permlink
                    }]
                )

                // Далее используем функцию бродкаста в Golos API и отправим операцию custom_json в блокчейн

                golos.broadcast.customJson(postingkey, [], [REBLOGGER], "follow", json, (err, result) => {
                    if (err) return

                    // После того, как мы сделали репост, отправим комментарий пользователю и проголосуем за его пост
                    // Но здесь проблема, если делать реблоги мы можем сотням аккаунтов в секунду, то оставлять комментарии, не более раза в 20 секунд. 
                    // Таким образом нам нужно задать острочку в 20 секунд для каждого комментария
                    console.log(`\x1b[32m🔗 [Сделан реблог] [${author}] ${title}\x1b[0m`)
                    setTimeout(() => {

                        // Подпишем в jsonmetada наш скрипт, это полезно для аналитики платформы
                        let jsonMetadata = {
                            "tags": ["vik"],
                            "app": "vik reblogger script ✉️ t.me/@chain_cf"
                        }

                        // Cохраним временной штамп в переменную, его будем делать "хвостом ссылки"
                        // Это необходимо, что бы сделать каждую ссылку уникальной
                        let timestamp = Date.now();

                        // Отправляем комментарий с зараннее подготовленными в настройках скрипта параметрами
                        golos.broadcast.comment(postingkey, author, permlink, REBLOGGER,
                            'comment-from-' + REBLOGGER + timestamp,
                            TITLE,
                            COMMENT,
                            jsonMetadata, (err, result) => {
                                if (err) return console.log(`\x1b[31m☹️ Невозможно отправить комменатарий к посту [${title}]\x1b[0m`)
                                // При каждом сработанном комментарии увеличиваем переменную на +1

                                // Голосуем за пост, которому сделали репост
                                console.log(`\x1b[96m💬 [Отправлен комментарий и upvote ${count}][${author}] ${title}\x1b[0m`)
                                golos.broadcast.vote(postingkey, REBLOGGER, author, permlink, VOTEPOWER, (error, result) => {
                                    //console.log(error,result)
                                });

                            })

                        // Увеличиваем отсрочку каждого комментария, что бы публиковать его не чаще, чем 1 раз в 20 секунд
                    }, count * 21000)
                    count++

                })
            }
        }
    })
}
