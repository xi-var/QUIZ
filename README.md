# 퀴즈노트

글, 사진, PDF를 넣으면 빈칸 객관식·OX·단답 문제를 만들고, 틀린 문제는 본문 근거와 함께 오답노트에 모아 주는 학습 앱이에요. 서버 없이 폰 브라우저 안에서만 돌아가고, 오답노트는 그 기기의 브라우저에만 저장돼요.

## 할 수 있는 것

| 기능 | 방식 | 인터넷 |
|---|---|---|
| 글 붙여넣기, .txt | 바로 읽기 | 필요 없음 |
| 텍스트 PDF | pdf.js로 글 추출 | 처음 열 때 필요 |
| 사진, 스캔 PDF | Tesseract.js로 글자 인식 (한글+영어) | 처음 한 번 필요 |
| 문제 만들기 | 핵심어와 문장을 규칙으로 골라 생성 | 필요 없음 |
| 풀이, 채점, 오답 피드백, 오답노트 | 앱 안에서 처리 | 필요 없음 |

## 한계

- 문제는 규칙으로 만들어서 교과서처럼 정리된 글에서 잘 나와요. 보기에 어색한 단어가 섞이기도 해요.
- 사진 글자 인식은 Tesseract라서 한글에 띄어쓰기가 어긋나거나 틀린 글자가 생길 수 있어요. 읽은 글은 위 칸에서 고쳐 주세요. 선명하고 똑바로 찍은 인쇄물일수록 잘 읽어요.
- 인식 데이터는 처음 사진을 읽을 때 내려받아요. 이후에는 브라우저에 저장된 걸 써요.

## 깃허브에 올려서 폰에서 쓰기

1. github.com에 로그인하고 **New repository**를 눌러요. 이름은 `quiznote`, 공개(Public)로 만들어요. 공개 저장소에는 이 앱의 코드만 올라가고 내 자료나 오답노트는 올라가지 않아요.
2. 만든 저장소에서 **Add file → Upload files**를 눌러요. 이 폴더 안의 파일을 전부 올리고(폴더째가 아니라 파일들) **Commit changes**를 눌러요.
   - 올릴 파일: `index.html`, `style.css`, `engine.js`, `app.js`, `sw.js`, `manifest.webmanifest`, `icon-180.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `.nojekyll`, `README.md`, `engine.test.js`
   - `.nojekyll`은 이름이 점으로 시작해서 폰 파일 선택창에서 안 보일 수 있어요. 없어도 앱은 돌아가요.
3. 저장소의 **Settings → Pages**로 가서 Source를 **Deploy from a branch**, Branch를 **main / (root)**로 두고 **Save**를 눌러요.
4. 1~2분 뒤 `https://내아이디.github.io/quiznote/`에서 열려요.
5. 폰에서 그 주소를 열고 홈 화면에 추가해요.
   - 안드로이드 크롬: 메뉴(⋮) → **앱 설치** 또는 **홈 화면에 추가**
   - 아이폰 사파리: 공유 버튼 → **홈 화면에 추가**

## 고칠 때

- 파일을 바꿔서 다시 올린 뒤에는 `sw.js` 맨 위의 `CACHE = 'quiznote-v1'`의 숫자를 올려 주세요(`v2`, `v3`…). 그래야 설치한 앱이 새 파일을 받아요.
- 문제 만드는 규칙은 `engine.js`에 있어요. 고친 뒤 PC에서 `node engine.test.js`로 검사할 수 있어요.
- 한글 인식 데이터를 저장소에 같이 넣어 인터넷 없이 쓰려면 `kor.traineddata.gz`와 `eng.traineddata.gz`를 저장소에 올리고, `app.js`의 `createWorker` 옵션에 `langPath: './'`을 추가하세요.

## 파일 구성

```
index.html            화면
style.css             스타일
engine.js             문제 생성, 채점 규칙
app.js                화면 동작, 파일 읽기, 오답노트
sw.js                 앱 파일을 기기에 저장 (오프라인 실행)
manifest.webmanifest  홈 화면 설치 정보
icon-*.png            앱 아이콘
engine.test.js        문제 생성 검사
```
