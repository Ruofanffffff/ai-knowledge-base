# Social Login Implementation Plan (WeChat & Alipay)

## Overview
To enable WeChat and Alipay login in the mobile app, you need to integrate the respective SDKs using Capacitor plugins and configure the backend to verify the authorization codes.

## Prerequisites
1.  **WeChat Open Platform Account**: Register an app to get `AppID` and `AppSecret`.
2.  **Alipay Open Platform Account**: Register an app to get `AppID` and `PrivateKey`.
3.  **Backend Support**: Endpoints to handle the OAuth callback/token exchange.

## Step 1: Install Capacitor Plugins
Use the community-maintained plugins:

```bash
# WeChat
npm install capacitor-wechat-sdk
npx cap update

# Alipay
npm install capacitor-alipay-sdk
npx cap update
```

## Step 2: Configure Native Projects

### Android (`android/app/src/main/AndroidManifest.xml`)
Add the necessary permissions and activity entries for callbacks.

**WeChat:**
```xml
<activity
    android:name=".wxapi.WXEntryActivity"
    android:label="@string/app_name"
    android:theme="@android:style/Theme.Translucent.NoTitleBar"
    android:exported="true"
    android:taskAffinity="your.package.name"
    android:launchMode="singleTask">
</activity>
```

**Alipay:**
Standard configuration usually handled by the plugin, but check for `scheme` configuration.

### iOS (`ios/App/App/Info.plist`)
Add URL Schemes for callback.

```xml
<key>LSApplicationQueriesSchemes</key>
<array>
    <string>weixin</string>
    <string>wechat</string>
    <string>alipay</string>
</array>
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLName</key>
        <string>weixin</string>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>YOUR_WECHAT_APPID</string>
        </array>
    </dict>
    <dict>
        <key>CFBundleURLName</key>
        <string>alipay</string>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>YOUR_ALIPAY_APPID</string>
        </array>
    </dict>
</array>
```

## Step 3: Frontend Implementation (`Auth.tsx`)

Replace the mock functions with real plugin calls.

```typescript
import { WeChat } from 'capacitor-wechat-sdk';
// import { Alipay } from 'capacitor-alipay-sdk'; // Check plugin docs for exact import

const handleWeChatLogin = async () => {
  try {
    const result = await WeChat.sendAuthRequest({
      scope: "snsapi_userinfo",
      state: "hibrain_login"
    });
    // result.code is the authorization code
    // Send this code to your backend
    const { data } = await api.post('/auth/oauth/wechat', { code: result.code });
    // Handle login success...
  } catch (err) {
    console.error(err);
  }
};
```

## Step 4: Backend Implementation

Ensure your backend has endpoints to exchange the `code` for an `access_token` and `openid`.

- **POST /auth/oauth/wechat**:
    1. Receive `code`.
    2. Call WeChat API: `https://api.weixin.qq.com/sns/oauth2/access_token?appid=...&secret=...&code=...&grant_type=authorization_code`
    3. Get `openid` (and `unionid`).
    4. Find or create user in your DB.
    5. Return JWT.

- **POST /auth/oauth/alipay**:
    Similar flow using Alipay's SDK/API.
