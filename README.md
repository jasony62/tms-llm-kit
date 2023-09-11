`tms-llm-kit`以`langchain`为基础，实现了基于文件、`wikijs`、`tms-mongodb-web`等语料源建立和使用向量数据库的功能。

将文本资料加载到向量数据库中，可以实现语义搜索功能。资料中的内容向量化后用于语义搜索，元数据用于关键字匹配连接其他相关的数据。因此，加载资料时需要指定哪些部分是内容，哪些部分是元数据。语言大模型的向量空间是私有的，使用哪个大模型就要用它提供的接口做向量化。向量化接口有长度限制，执行向量计算前要将分档拆分为适当的大小。

讯飞星火向量接口：

- 文本长度不超过 256 个字符，超过会只截取前 256 个字符进行向量化

百度文心输入文本以获取 embeddings。说明：

- （1）文本数量不超过 16
- （2）每个文本长度不超过 384 个 token
- （3）输入文本不能为空，如果为空会报错

目前，支持加载的资料包括：csv 格式文件，json 格式文件和 wikijs 在线接口。

目前，向量数据库使用`hnswlib`。它是个轻量级的内存数据库，可以把数据持久化在本地文件。

考虑到数据安全要求，用户有些用不希望发送给大模型。针对这种情况，支持将加载的资料分为向量化和非向量化两部分分别存储。非向量化的数据不会调用大模型的向量化接口，只是转换为标准文档格式存储。

构造好向量数据库后，就可以实现语义检索。目前支持：

- 方式一：输入文本，按照语义从数据库中检索匹配的文档并返回文档。
- 方式二：输入文本，按照语义从数据库中检索匹配的文档，将检索的文档作为提示内容传给大模型，由大生成回复内容。
- 方式三：输入文本，按照语义从数据库中检索匹配的文档，根据文档的元数据，再非向量化文档库中按元数据检索。
- 方式四：直接输入元数据，从文档库中匹配文档。

在`Q&A`的场景中，如果需要根据用户的输入，从某个文档中，例如：用户手册，直接匹配答案，那么就使用**方式一**。

方式一有个缺陷，因为文档加载时需要根据大模型向量化接口的限制控制文本块的大小，所以向量对应的文本块可能不是完整的段落，不能直接作为回复，这种情况可以使用**方式四**，让语言大模型基于检索的内容生成更自然的答案。

如果，原始的资料问题和答案是分开，且需要给用户返回标准的答案，那么就采用**方式三**。

**注意**：当前版本的主要目的是进行技术和功能的验证，用于生产还需要考虑数据安全、性能、可维护性等问题。

# 编译

> pnpm i

> pnpm build

新建`.env`文件，指定语言大模型参数，目前支持百度文心和讯飞星火。

```
# 百度文心
BAIDUWENXIN_APP_ID=
BAIDUWENXIN_API_KEY=
BAIDUWENXIN_SECRET_KEY=
# 讯飞星火
XUNFEISPARK_APP_ID=
XUNFEISPARK_SECRET_KEY=
XUNFEISPARK_API_KEY=
# wikijs
WIKIJS_API_KEY=
```

# 资料加载

基于资料构造向量数据库的基本过程如下：

```mermaid
flowchart TD
A((开始))
Z((结束))

S1[加载文档]
S2[拆分文档]
S3[文档块向量化]
S4[构造向量数据库]
S5[保存到本地]
A --> S1
S1 --> S2
S2 --> S3
S3 --> S4
S4 --> S5
S5 --> Z

```

执行如下命令加载文件，并生成向量数据库。

字段`q`和字段`a`都执行向量化，可通过语义检索；字段`id`作为元数据。

```shell
DEBUG=* node ./dist/build --type csv --file ./sample/data01-faq.csv --as-vec q,a --as-meta id --store ./store/data01-faq-wx --model baiduwenxin
```

```shell
DEBUG=* node ./dist/build --type json --file ./sample/data02-faq.json --as-vec q,a --as-meta id --store ./store/data02-faq-wx --model baiduwenxin
```

```shell
DEBUG=* node ./dist/build --type csv --file ./sample/data01-faq.csv --as-vec q,a --as-meta id --store ./store/data01-faq-xf --model xunfeispark
```

```shell
DEBUG=* node ./dist/build --type json --file ./sample/data02-faq.json --as-vec q,a --meta id --store ./store/data02-faq-xf --model xunfeispark
```

字段`q`执行向量化，可通过语义检索；字段`a`直接保存为文档，仅可通过元数据检索；字段`id`作为元数据。

```shell
DEBUG=* node ./dist/build --type csv --file ./sample/data02-faq.csv --as-vec q --as-doc a --as-meta id --store ./store/data01-faq-wx --model baiduwenxin
```

从`wikijs`加载，不支持非向量化文档。

```shell
DEBUG=* node ./dist/build --type wikijs --url 'http://localhost:8444/graphql' --store ./store/wikijs-wx --model baiduwenxin
```

```shell
DEBUG=* node ./dist/build --type wikijs --url 'http://localhost:8444/graphql' --store ./store/wikijs-xf --model xunfeispark
```

从`tms-mongodb-web`加载

```shell
DEBUG=* node ./dist/build --type tmw --url 'http://localhost:6030/api/admin/document/list?db=e2e5gmx&cl=dialog_script' --as-meta _id,name --as-vec title,remark --model baiduwenxin --store ./store/tmw-wx
```

从`mongodb`加载

```shell
DEBUG=* node ./dist/build --type mongodb --url 'mongodb://root:root@localhost:27017' --db-name e2e5gmx --cl-name rcs_file --as-meta _id,name --as-vec title,remark --model baiduwenxin --store ./store/mongodb-wx
```

| 参数    | 说明                                   | 类型 | 默认值 |
| ------- | -------------------------------------- | ---- | ------ |
| type    | 数据类型，支持：json，csv 和 wikijs。  |      | 无     |
| file    | 要加载的文件路径，适用于 json 和 csv。 |      | 无     |
| url     | wikijs 的 api 地址。                   |      | 无     |
| as-vec  | 作为向量处理的字段。                   |      |        |
| as-doc  | 作为文档处理的字段。                   | 数组 |        |
| as-meta | 作为元数据处理的字段。                 | 数组 |        |
| store   | 生成的向量数据库存储路径。             |      | 无     |
| model   | 使用的语言大模型。                     |      | 无     |

字段：csv 文件中的列，json 对象的字段路径。

参考：

https://docs.requarks.io/dev/api

# 检索数据

根据输入的文本（text）和元数据过滤条件（filter）(可不写)，返回匹配的文档。

```shell
DEBUG=* node ./dist/retrieve --model baiduwenxin --store ./store/data01-faq-wx --perset vector-doc --text 风险 --filter '{"/_pageContentSource":"q"}'
```

```json
[
  {
    "pageContent": "语言大模型有哪些风险",
    "metadata": {
      "source": "./sample/data01-faq.csv",
      "_pageContentSource": "q",
      "id": "7",
      "loc": {
        "lines": {
          "from": 1,
          "to": 1
        }
      }
    }
  }
]
```

先根据输入的文本（text）和过滤条件（filter）搜索相似的文档，再用文档的元数据（nonvec-match）在非向量库中进行元数据搜索。

```shell
DEBUG=* node ./dist/retrieve --model baiduwenxin --store ./store/data01-faq-wx --perset nonvec-doc --text 风险 --filter '{"/_pageContentSource":"q"}' --nonvec-match '/id' --nonvec-filter '{"/_pageContentSource":"a"}'
```

```json
[
  {
    "pageContent": "生成文本的单调性或重复性问题。对于某些语言的处理能力有限。对于某些复杂语言问题的处理能力有限。对于某些特定领域或专业知识的处理能力有限。存在数据泄露和隐私安全问题。",
    "metadata": {
      "source": "./sample/data01-faq.csv",
      "_pageContentSource": "a",
      "id": "7"
    }
  }
]
```

将检索到的文本作为素材提供给大模型生成答案。

```shell
DEBUG=* node ./dist/retrieve --model baiduwenxin --store ./store/data01-faq-wx --perset llm-answer --text 风险
```

```json
[
  {
    "pageContent": "风险：\n\n1. 语言模型可能存在偏见，导致其输出的结果存在偏见，从而影响用户的体验。\n2. 语言模型可能存在错误，导致其输出的结果存在错误，从而影响用户的体验。\n3. 语言模型可能存在安全问题，导致其输出的结果存在安全问题，从而影响用户的体验。",
    "metadata": {}
  }
]
```

根据指定的元数据过滤条件（filter），在向量化文档库中搜索，返回匹配的文档。

```shell
DEBUG=* node ./dist/retrieve --model baiduwenxin --store ./store/data01-faq-wx --perset meta-vector-doc --filter '{"/id":"1"}'
```

```json
[
  {
    "pageContent": "什么是语言大模型",
    "metadata": {
      "source": "./sample/data01-faq.csv",
      "_pageContentSource": "q",
      "id": "1",
      "loc": {
        "lines": {
          "from": 1,
          "to": 1
        }
      }
    }
  }
]
```

根据指定的元数据过滤条件（filter），在非向量化文档库中搜索，返回匹配的文档。

```shell
DEBUG=* node ./dist/retrieve --model baiduwenxin --store ./store/data01-faq-wx --perset meta-nonvec-doc --filter '{"/id":"1"}'
```

```json
[
  {
    "pageContent": "语言大模型是一种基于深度学习技术的人工智能模型，它可以自动从大量文本数据中学习语言规律，并生成类似人类的自然语言文本。",
    "metadata": {
      "source": "./sample/data01-faq.csv",
      "_pageContentSource": "a",
      "id": "1"
    }
  }
]
```

| 参数          | 说明                              | 类型 | 默认值 |
| ------------- | --------------------------------- | ---- | ------ |
| model         | 使用的语言大模型。                | 文本 | 无     |
| store         | 向量数据目录地址。                | 文本 | 无     |
| perset        | 预定义的检索方式。                | 文本 | 无     |
| text          | 检索条件。                        | 文本 | 无     |
| filter        | 文档过滤条件。JSON 格式的字符串。 | JSON | 无     |
| nonvec-match  | 文档匹配字段。                    | 数组 | 无     |
| nonvec-filter | 文档过滤条件。JSON 格式的字符串。 | JSON | 无     |
| as-doc        | 原始数据中作为文档处理的字段。    | 数组 |        |
| as-meta       | 原始数据中作为元数据处理的字段。  | 数组 |        |

**注意**：检索命令的参数中表示字段的地方，都用`jsonpointer`格式表示，例如：`/_pageContentSource`。

参考：https://www.npmjs.com/package/jsonpointer

# 计算向量

```shell
node ./dist/embedding --model baiduwenxin --text 介绍语言大模型
```

# 构造 docker 镜像

在项目根目录下执行

构造镜像

> docker build -t jasony62/tms-llm-kit .

在容器中执行

> docker run -it --rm --name tlk-test -v $PWD/.env:/usr/tms-llm-kit/.env -v $PWD/store:/usr/store jasony62/tms-llm-kit sh
