# Sparring — submitted copy

Submitted September30,2026 ~08:47ECT. Public submission: https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon/sparring/sparring-practice-tough-customer-conversations

## Project title

Sparring — Practice Tough Customer Conversations

## Short description (under 255 characters)

Rehearse difficult sales and support conversations by voice with a simulated customer. Sparring turns in-call observations into evidence-backed feedback, then helps you practice one better response.

## Long description (over 100 words)

Sales and support teams need a safe place to practice difficult conversations before a real customer is on the line. Sparring is a browser-based voice role-play for small Spanish-speaking teams. Choose a scenario such as a delayed delivery, a price objection, or a cancellation request, then speak with a simulated customer who asks follow-up questions and challenges vague answers. AssemblyAI's Voice Agent API handles the spoken interaction. Sparring checks each finalized trainee turn against the scenario rubric, validates exact quotes as evidence, and calculates a weighted score in real time. The interface shows how much of the rubric was observed and gives one focused next step to practice again. The scenarios use fictional customers and explicit policy limits, so the trainee can rehearse useful responses without making commitments to real people. Scores are formative guidance, not a certification. The public repository includes the specification, tests, architecture, and known limitations.

## Links

- Demo: https://sparring.visitaremota.com/
- Public repository: https://github.com/jlmawyin/sparring
- Video (Spanish voice, English subtitles, 3:42): https://storage.googleapis.com/lablab-video-submissions/submissions/w1n7yq0n3mdwv80f5njsmhcp/owxjotv4oxbvrximwo2ink1z/video/video_fdqm9ywdy8ayah110dwn27zm.mp4
- Slides: `submission-assets/slides.pdf`
- Cover: `submission-assets/cover.png`

## Tags to choose if offered

AssemblyAI, Voice Agents, Sales Training, Customer Support, EdTech

## Application details saved in draft

Platform: Other — Contabo VPS, Docker, Cloudflare HTTPS.

Additional information:

Hosted on a Contabo VPS using Docker, with HTTPS through Cloudflare. Open the demo in a microphone-enabled desktop browser, use headphones, choose Late delivery, and accept the voice consent before starting. The practice is in Spanish; the recorded video includes English subtitles. A session lasts up to four minutes including coaching and is subject to the public demo's daily usage cap. The recording shows a real conversation and its actual result: 75/100 with 100% rubric coverage. Sparring evaluates finalized trainee transcripts with deterministic rules and exact quote checks; the rubric is formative and does not assess vocal tone or certify performance. The next validation step is a pilot with small Spanish-speaking sales and support teams. The repository contains the MIT license, setup instructions, specification, tests, and known limitations.

## Release gate

Before pasting, verify the public demo completes a real voice session, two in-call rubric updates, feedback, and mic cleanup. If a gate fails, edit the claims to match the observed behavior and record the limitation in the README and submission.
