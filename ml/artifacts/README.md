# Trusted local artifacts only

`make ml-smoke` generates three synthetic baseline artifacts and an evaluation JSON here. These are ignored by Git and never deployed to the API. They do not measure real-world detection accuracy.

Only load joblib files you generated in a trusted checkout. Hashes detect corruption but do not protect against an attacker replacing both a model and its manifest.
