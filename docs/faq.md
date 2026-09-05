# Collective Agreements — FAQ

## Is the AI analysis authoritative?

No. It is a structured starting point, labelled as AI-generated until a community edit is accepted. Read the source document for any decision that matters; the project does not provide legal advice.

## Who can submit and edit?

Registered users can submit public agreements and propose edits. New edits enter moderation. Users become trusted after five accepted edits and then publish their own revisions immediately; moderators and administrators can also publish immediately.

## Which documents can I submit?

Submit publicly available collective agreements with a source URL. The API accepts PDFs, plain text, PNG, JPEG, TIFF, and WebP files up to 25 MB, or pasted text of at least 1,000 characters. Individual employment contracts and private or leaked material do not belong in the library.

## Can the project handle agreements in languages other than English?

Yes. The analyzer records the original language and aims to produce an English summary. OCR quality and model output still require review against the original document.

## What happens when the original source URL disappears?

File uploads are kept in object storage and published agreements expose the archived original. Pasted text has no original file to download, but its source URL remains part of the agreement record.

## How can I follow changes?

Use the recent-changes page and each agreement's revision history. The site also exposes an Atom feed at `/changes.xml` when `PUBLIC_SITE_URL` is configured.
