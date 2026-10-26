import json
import os
import urllib.error
import urllib.request


def handler(event, context):
    for record in event["Records"]:
        alarm = json.loads(record["Sns"]["Message"])
        text = (
            f'{alarm.get("AlarmName", "CloudWatch")}: '
            f'{alarm.get("NewStateValue", "UNKNOWN")}\n'
            f'{alarm.get("NewStateReason", "")}'
        )
        request = urllib.request.Request(
            "https://api.telegram.org/bot"
            + os.environ["TELEGRAM_BOT_TOKEN"]
            + "/sendMessage",
            data=json.dumps({
                "chat_id": os.environ["TELEGRAM_CHAT_ID"],
                "text": text[:4000],
            }).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                result = json.load(response)
        except urllib.error.HTTPError as exc:
            raise RuntimeError(f"Telegram HTTP {exc.code}") from None
        except urllib.error.URLError:
            raise RuntimeError("Telegram connection failed") from None
        if not result.get("ok"):
            raise RuntimeError("Telegram rejected the message")
