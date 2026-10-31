# Prime Launcher — IPC API Contract

**Contract version:** 1.0.0-stage1  
**Transport:** `ipcRenderer.invoke` / `ipcMain.handle` for request-response calls. Events are sent by the main process to the renderer.  
**Security:** The renderer must use only `window.prime`; raw Electron APIs and Node.js are unavailable. All IDs are opaque strings. All dates use ISO-8601 strings. Sizes are bytes unless a field name says otherwise.

This document is the source of truth for channel names and payload shapes. Do not rename a channel or alter an existing field. Backward-compatible additions belong at the end under **Additions**.

## Conventions

## Renderer trust boundary

Only the primary local renderer document (`src/renderer/index.html`) may call the exposed IPC API. Main-process handlers reject calls from child frames, other web contents, or a document URL other than the packaged local renderer entry point. Renderer navigation is locked to the loaded document; new windows are denied and external links are opened only for HTTPS URLs. Do not bypass these checks from renderer code.


- `string`, `number`, `boolean`, `string[]`, `object`, and `null` have their usual JSON meanings.
- `?` means optional. `[]` means array. `A | B` means a union.
- Every successful invoke resolves to `{ "ok": true, "data": ... }` unless the result is a simple window command, which resolves to `{ "ok": true }`.
- Expected errors resolve to `{ "ok": false, "error": { "code": string, "message": string } }`; they do not reject the renderer promise for normal application errors.
- `patch` objects contain only fields being changed. Unknown fields must be ignored or rejected, not persisted.

## 1. Window

| Renderer method | IPC channel | Input | Output |
|---|---|---|---|
| `prime.window.minimize()` | `window:minimize` | none | `{ok:true}` |
| `prime.window.toggleMaximize()` | `window:toggle-maximize` | none | `{ok:true, data:{maximized:boolean}}` |
| `prime.window.close()` | `window:close` | none | `{ok:true}` |
| `prime.window.openLogs()` | `window:open-logs` | none | `{ok:true, data:{path:string}}` |

## 2. Settings

| Renderer method | IPC channel | Input | Output |
|---|---|---|---|
| `prime.settings.get()` | `settings:get` | none | `{ok:true,data:Settings}` |
| `prime.settings.update(patch)` | `settings:update` | `SettingsPatch` | `{ok:true,data:Settings}` |
| `prime.settings.reset()` | `settings:reset` | none | `{ok:true,data:Settings}` |

`Settings` shape:

```json
{
  "language": "ar|en",
  "theme": "system|light|dark|oled",
  "accent": "nether|red|orange|amber|yellow|lime|green|cyan|blue|purple|pink|custom",
  "customAccent": "#RRGGBB",
  "layout": "modern|classic",
  "startOnBoot": false,
  "startMinimized": false,
  "minimizeToTray": true,
  "hideLauncherOnLaunch": false,
  "analytics": false,
  "discordPresence": false,
  "notifications": true,
  "notificationSound": true,
  "storageDirectory": "string"
}
```

`SettingsPatch` is a partial `Settings` object.

## 3. Accounts

| Renderer method | IPC channel | Input | Output |
|---|---|---|---|
| `prime.accounts.list()` | `accounts:list` | none | `{ok:true,data:Account[]}` |
| `prime.accounts.addOffline({username})` | `accounts:add-offline` | `{username:string}` | `{ok:true,data:Account}` |
| `prime.accounts.beginMicrosoftLogin()` | `accounts:begin-microsoft-login` | none | `{ok:true,data:{status:"started"|"not_configured"|"unsupported",message:string,verificationUri?:string,userCode?:string}}` |
| `prime.accounts.cancelMicrosoftLogin()` | `accounts:cancel-microsoft-login` | none | `{ok:true,data:{cancelled:boolean}}` |
| `prime.accounts.switch({id})` | `accounts:switch` | `{id:string}` | `{ok:true,data:Account[]}` |
| `prime.accounts.logout({id})` | `accounts:logout` | `{id:string}` | `{ok:true,data:Account[]}` |

`Account` shape:

```json
{
  "id": "string",
  "username": "string",
  "uuid": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "type": "offline|microsoft",
  "active": true,
  "connected": true,
  "skinUrl": "string|null",
  "createdAt": "ISO-8601"
}
```

Offline username validation is 3–16 characters matching `^[a-zA-Z0-9_]{3,16}$`. Offline UUID is the UUID-v3/MD5 result for the UTF-8 bytes of `OfflinePlayer:<username>` using the Minecraft offline UUID convention (MD5 digest with version/variant bits set).

## 4. Versions

| Renderer method | IPC channel | Input | Output |
|---|---|---|---|
| `prime.versions.list(options)` | `versions:list` | `{includeSnapshots?:boolean,includeOld?:boolean,limit?:number}` | `{ok:true,data:Version[]}` |
| `prime.versions.latest()` | `versions:latest` | none | `{ok:true,data:Version}` |
| `prime.versions.manifest()` | `versions:manifest` | none | `{ok:true,data:{latest:{release:string,snapshot:string},versions:Version[]}}` |

`Version` shape: `{id:string,type:"release|snapshot|old_beta|old_alpha",releaseTime:string,url?:string}`.

## 5. Instances

| Renderer method | IPC channel | Input | Output |
|---|---|---|---|
| `prime.instances.list()` | `instances:list` | none | `{ok:true,data:Instance[]}` |
| `prime.instances.create(input)` | `instances:create` | `CreateInstanceInput` | `{ok:true,data:Instance}` |
| `prime.instances.get({id})` | `instances:get` | `{id:string}` | `{ok:true,data:Instance|null}` |
| `prime.instances.update({id,patch})` | `instances:update` | `{id:string,patch:InstancePatch}` | `{ok:true,data:Instance}` |
| `prime.instances.delete({id})` | `instances:delete` | `{id:string}` | `{ok:true,data:{deleted:boolean}}` |
| `prime.instances.duplicate({id})` | `instances:duplicate` | `{id:string}` | `{ok:true,data:Instance}` |
| `prime.instances.openFolder({id})` | `instances:open-folder` | `{id:string}` | `{ok:true,data:{path:string}}` |
| `prime.instances.import({filePath})` | `instances:import` | `{filePath:string}` | `{ok:true,data:Instance}` |
| `prime.instances.export({id})` | `instances:export` | `{id:string}` | `{ok:true,data:{filePath:string}}` |

`CreateInstanceInput`: `{name?:string,version:string,loader:"vanilla|fabric|forge|neoforge|quilt",loaderVersion?:string,icon?:string,launchAfterInstall?:boolean}`.  
`Instance`: `{id:string,name:string,version:string,loader:string,loaderVersion:string|null,icon:string,lastPlayed:string|null,playtimeMinutes:number,createdAt:string,status:"ready|installing|error",linkedPack?:{projectId:string,source:"modrinth|curseforge",name:string}|null}`.  
`InstancePatch` may contain `{name:string,icon:string,version:string,loader:string,loaderVersion:string,playtimeMinutes:number}`.

## 6. Launch

| Renderer method | IPC channel | Input | Output |
|---|---|---|---|
| `prime.launch.start(input)` | `launch:start` | `{instanceId:string,serverAddress?:string}` | `{ok:true,data:{sessionId:string,status:"started"|"mock"}}` |
| `prime.launch.stop({instanceId})` | `launch:stop` | `{instanceId:string}` | `{ok:true,data:{stopped:boolean}}` |
| `prime.launch.onProgress(callback)` | event `launch:progress` | registers listener | unsubscribe function |
| `prime.launch.onLog(callback)` | event `launch:log` | registers listener | unsubscribe function |

`launch:progress` event payload: `{instanceId:string,sessionId:string,percent:number,stage:string}`.  
`launch:log` event payload: `{instanceId:string,sessionId:string,level:"info|warn|error",message:string,timestamp:string}`.  
The current stage implementation emits mock events only; it does not start Java or Minecraft.

## 7. Java

| Renderer method | IPC channel | Input | Output |
|---|---|---|---|
| `prime.java.detect()` | `java:detect` | none | `{ok:true,data:{platform:string,arch:string,available:boolean,defaultPath:string|null}}` |
| `prime.java.list()` | `java:list` | none | `{ok:true,data:JavaRuntime[]}` |
| `prime.java.install({version})` | `java:install` | `{version:"8|16|17|21|25"}` | `{ok:true,data:JavaRuntime}` |
| `prime.java.remove({version})` | `java:remove` | `{version:string}` | `{ok:true,data:{removed:boolean}}` |

`JavaRuntime`: `{version:string,vendor:string,status:"installed|missing|checking",path:string|null}`.

## 8. Content — Modrinth / CurseForge

| Renderer method | IPC channel | Input | Output |
|---|---|---|---|
| `prime.content.search(query)` | `content:search` | `ContentSearchQuery` | `{ok:true,data:{hits:ContentProject[],totalHits:number,offset:number,limit:number}}` |
| `prime.content.getProject({id,source})` | `content:get-project` | `{id:string,source:"modrinth|curseforge"}` | `{ok:true,data:ContentProject|null}` |
| `prime.content.install(input)` | `content:install` | `{projectId:string,source:"modrinth|curseforge",instanceId?:string,versionId?:string}` | `{ok:true,data:{installed:boolean,instanceId:string|null}}` |

`ContentSearchQuery`: `{query?:string,source:"modrinth|curseforge",type:"modpack|mod|resourcepack|shader|datapack|world",gameVersion?:string,loader?:string,sort:"downloads|follows|updated|newest",offset?:number,limit?:number}`.  
`ContentProject`: `{id:string,source:string,title:string,description:string,author:string,downloads:number,iconUrl:string,bannerUrl:string,gameVersions:string[],loaders:string[],projectType:string,url:string}`.

## 9. Servers

| Renderer method | IPC channel | Input | Output |
|---|---|---|---|
| `prime.servers.list(filters)` | `servers:list` | `ServerFilters` | `{ok:true,data:{servers:Server[],total:number,totalPlayers:number}}` |
| `prime.servers.get({id})` | `servers:get` | `{id:string}` | `{ok:true,data:Server|null}` |
| `prime.servers.ping({address})` | `servers:ping` | `{address:string}` | `{ok:true,data:{online:boolean,players:number,version:string,motd:string}}` |
| `prime.servers.toggleFavorite({id})` | `servers:toggle-favorite` | `{id:string}` | `{ok:true,data:{favorite:boolean}}` |

`ServerFilters`: `{query?:string,region?:string,offlineSupported?:boolean,version?:string,tags?:string[],featuredOnly?:boolean,favoritesOnly?:boolean,sort?:"players|name|featured"}`.  
`Server`: `{id:string,name:string,address:string,region:string,players:number,maxPlayers:number,online:boolean,version:string,tags:string[],offlineSupported:boolean,featured:boolean,favorite:boolean,bannerUrl:string,description:string}`.

## 10. News

| Renderer method | IPC channel | Input | Output |
|---|---|---|---|
| `prime.news.list()` | `news:list` | none | `{ok:true,data:NewsItem[]}` |
| `prime.news.refresh()` | `news:refresh` | none | `{ok:true,data:NewsItem[]}` |

`NewsItem`: `{id:string,title:string,summary:string,imageUrl:string,publishedAt:string,url:string,source:string}`.

## 11. Skins

| Renderer method | IPC channel | Input | Output |
|---|---|---|---|
| `prime.skins.get()` | `skins:get` | none | `{ok:true,data:{skinUrl:string|null,capeUrl:string|null,accountType:string}}` |
| `prime.skins.applyOffline(input)` | `skins:apply-offline` | `{filePath?:string,url?:string}` | `{ok:true,data:{applied:boolean,skinUrl:string|null}}` |
| `prime.skins.selectFile()` | `skins:select-file` | none | `{ok:true,data:{filePath:string|null}}` |

## 12. Storage

| Renderer method | IPC channel | Input | Output |
|---|---|---|---|
| `prime.storage.get()` | `storage:get` | none | `{ok:true,data:{directory:string,totalBytes:number,usedBytes:number,freeBytes:number,instancesBytes:number,sharedBytes:number}}` |
| `prime.storage.chooseDirectory()` | `storage:choose-directory` | none | `{ok:true,data:{directory:string|null}}` |

## 13. Playtime

| Renderer method | IPC channel | Input | Output |
|---|---|---|---|
| `prime.playtime.summary()` | `playtime:summary` | none | `{ok:true,data:PlaytimeSummary}` |

`PlaytimeSummary`: `{last7DaysMinutes:number,previous7DaysMinutes:number,changePercent:number,dailyMinutes:{day:string,minutes:number}[],averageSessionMinutes:number,longestSessionMinutes:number,daysPlayed:number}`.

## Additions

The following backwards-compatible channels were added after the initial contract (phase 2 and phase 3.1). Existing channel names and payloads above remain unchanged.

| Renderer method | IPC channel | Input | Output |
|---|---|---|---|
| `prime.accounts.onMicrosoftLoginStatus(callback)` | event `accounts:login-status` | registers listener | `{status:"complete"|"error"|"cancelled",message:string,account?:Account}` |
| `prime.instances.mods({id})` | `instances:mods` | `{id:string}` | `{ok:true,data:{fileName:string,enabled:boolean,bytes:number,sha1:string,duplicate:boolean}[]}` |
| `prime.instances.toggleMod({id,fileName})` | `instances:toggle-mod` | `{id:string,fileName:string}` | `{ok:true,data:{fileName:string,enabled:boolean}}` |
| `prime.instances.worlds({id})` | `instances:worlds` | `{id:string}` | `{ok:true,data:{name:string,path:string,modifiedAt:string}[]}` |
| `prime.instances.screenshots({id})` | `instances:screenshots` | `{id:string}` | `{ok:true,data:{fileName:string,path:string,bytes:number,modifiedAt:string}[]}` |
| `prime.instances.getOptions({id})` | `instances:options-get` | `{id:string}` | `{ok:true,data:object}` |
| `prime.instances.updateOptions({id,patch})` | `instances:options-update` | `{id:string,patch:object}` | `{ok:true,data:object}` |
| `prime.content.linkPack(input)` | `content:link-pack` | `{instanceId:string,projectId:string,source:"modrinth"|"curseforge",name:string}` | `{ok:true,data:Instance}` |
| `prime.content.unlinkPack({instanceId})` | `content:unlink-pack` | `{instanceId:string}` | `{ok:true,data:Instance}` |
| `prime.content.updatePack({instanceId})` | `content:update-pack` | `{instanceId:string}` | `{ok:true,data:{updated:boolean,instanceId:string,version:string}}` |
| `prime.servers.add({server})` | `servers:add` | `{server:Server}` | `{ok:true,data:Server}` |
| `prime.servers.remove({id})` | `servers:remove` | `{id:string}` | `{ok:true,data:{removed:boolean}}` |
| `prime.servers.updateList({url})` | `servers:update-list` | `{url:string}` | `{ok:true,data:{updated:boolean,count:number}}` |
| `prime.skins.serverInfo()` | `skins:server-info` | none | `{ok:true,data:{url:string,port:number,config:object}}` |
| `prime.instances.selectImportFile()` | `instances:select-import-file` | none | `{ok:true,data:{filePath:string|null}}` |
