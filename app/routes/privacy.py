from fastapi import APIRouter

from app.gamedata import guide

router = APIRouter(prefix="/api", tags=["privacy"])

PRIVACY_VERSION = "2026-10-v1"

BUILTIN_NOTICE = """Body Bastion - Privacy notice (Digital Personal Data Protection Act, 2023)

Who we are
Body Bastion is a free medical-education game run by Maulana Azad Medical College, New Delhi, for teaching gut infections, immunity and antibiotic stewardship, and for running an inter-college competition. The organisers are the Data Fiduciary for the personal data described here.

Purpose
We use your data only to: create and secure your game account; approve registrations; run the league, clan wars, classroom sessions and awards; show your handle and college on leaderboards; check battles for fair play; and contact you about the competition or about your data. We do not sell your data, show advertising, or use it for any other purpose. There are no paid items in the game.

Data we collect (minimum data)
- Account: username, a public handle (display name), college, course, password (stored only as a salted one-way hash), and optionally an email address.
- Age confirmation: whether you are 18 or older. For players under 18 we also collect the name and email address of a parent or legal guardian, who must consent on the player's behalf.
- Consent record: the version of this notice you accepted and when.
- Game data: your base, resources, research, battles (the commands you played and the results), scores, clan membership and classroom group names.
- Technical data: a login token and, briefly in memory only, your IP address to slow down password-guessing. We do not use tracking cookies or third-party analytics.
Guest play stores no personal data; guest accounts are deleted automatically after about 30 days.

What other people can see
Leaderboards, clan pages and the event projector show only your handle and college. Your username, email, course, age confirmation and guardian details are never shown publicly; only the organisers (administrators) can see them, to approve accounts and run the event. Organisers and appointed observers can review battle replays to check for cheating.

Where your data is processed
The game is hosted by Render (render.com) in its Singapore region, so your data is stored and processed in Singapore. Section 16 of the Act allows this transfer; Singapore is not a restricted country.

How long we keep it
We keep your data only until the competition and its results are finished. After the event the organisers delete all player data (accounts, bases, battles, clans and classroom data). You can delete your account and all of its data yourself at any time from the Profile screen; the deletion is immediate and cannot be undone.

Your rights
You (or your guardian, if you are under 18) may: get a summary of the data we hold about you; correct or complete it; withdraw consent and have your data erased (use "Delete my account" or contact us); nominate another person to exercise these rights if you die or become unable to; and complain to us and, if you are not satisfied, to the Data Protection Board of India. Withdrawing consent does not affect processing done before you withdrew it.

Children
Players under 18 may register only with the verifiable consent of a parent or legal guardian. Their accounts are never approved automatically: an organiser checks the guardian details first. We do not track children's behaviour or show them targeted content.

Grievance officer / contact
Body Bastion organisers, Maulana Azad Medical College, Bahadur Shah Zafar Marg, New Delhi 110002.
Email: grievance contact to be announced by the organisers before registration opens (ask your college coordinator).
We will reply to requests and grievances within 30 days.

Changes
If this notice changes, we will show the new version and ask for your consent again before using your data for any new purpose."""


def privacy_notice() -> dict:
    g = guide()
    p = g.get("privacy") if isinstance(g, dict) else None
    if isinstance(p, str) and p.strip():
        return {"version": PRIVACY_VERSION, "text": p}
    if isinstance(p, dict):
        text = p.get("text")
        if not isinstance(text, str) or not text.strip():
            parts = []
            for sec in p.get("sections") or []:
                if isinstance(sec, dict):
                    title = sec.get("title") or sec.get("heading") or ""
                    body = sec.get("text") or sec.get("body") or ""
                    if isinstance(body, list):
                        body = "\n".join(str(x) for x in body)
                    parts.append(f"{title}\n{body}".strip())
                elif isinstance(sec, str):
                    parts.append(sec)
            text = "\n\n".join(x for x in parts if x)
        if isinstance(text, str) and text.strip():
            version = p.get("version") if isinstance(p.get("version"), str) and p.get("version") else PRIVACY_VERSION
            return {"version": version, "text": text}
    return {"version": PRIVACY_VERSION, "text": BUILTIN_NOTICE}


@router.get("/privacy")
def get_privacy():
    return privacy_notice()
