// The one page the server writes itself: where a browser enters the access token.
export function accessPage(wrong: boolean): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Cuisine</title>
<link rel="manifest" href="/manifest.webmanifest">
<link rel="stylesheet" href="/access.css">
</head>
<body>
<form method="post" action="/access">
<h1>Cuisine</h1>
<label for="token">Access token</label>
<input id="token" name="token" type="password" autocomplete="current-password" autofocus required>
${wrong ? '<p role="alert">That isn’t it. Try again.</p>' : ''}
<button type="submit">Open</button>
</form>
</body>
</html>`;
}
