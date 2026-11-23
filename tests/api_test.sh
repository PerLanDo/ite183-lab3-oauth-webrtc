#!/bin/bash
# Usage: start the server, then: BASE=http://localhost:3001 bash tests/api_test.sh
# Needs curl and node (node only parses JSON in this test; the server stays pure BSL).
# Endpoint test for the Lab 3 BSL server.
B=${BASE:-http://localhost:3001}
export LANG=C.UTF-8
export LC_ALL=C.UTF-8
pass=0; fail=0
# An unquoted empty $(...) status disappears and shifts the detail into $2, so print everything after the name.
check() { local name=$1; shift; if [ "$1" = "1" ]; then echo "PASS $name"; pass=$((pass+1)); else echo "FAIL $name :: $*"; fail=$((fail+1)); fi; }
post() { # token path json; use one HTTP request per process to avoid BSL's reused recv buffer
  local n=$(head -c 8 /dev/urandom | od -An -tx1 | tr -d ' \n')
  # Escape non-ASCII as \uXXXX exactly like public/app.js (asciiJSON); raw UTF-8 in argv is mangled by Windows.
  local body=$(node -e 'const o=JSON.parse(process.argv[1]);o.nonce=process.argv[2];process.stdout.write(JSON.stringify(o).replace(/[\u007f-￿]/g,c=>String.fromCharCode(92)+"u"+c.charCodeAt(0).toString(16).padStart(4,"0")))' "$3" "$n")
  curl --http1.0 -s -m 5 -X POST -H "Connection: close" -H "Content-Type: application/json" -H "X-Nonce: $n" ${1:+-H "Authorization: Bearer $1"} --data-binary "$body" "$B$2"
}
get() { curl --http1.0 -s -m 5 -H "Connection: close" ${1:+-H "Authorization: Bearer $1"} "$B$2"; }
jget() { node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const o=JSON.parse(d);console.log(eval('o.'+process.argv[1]))}catch(e){console.log('PARSEERR '+d.slice(0,200))}})" "$1"; }

for f in "/:public/index.html" "/app.js:public/app.js" "/style.css:public/style.css"; do
  u=${f%%:*}; p=${f#*:}
  got=$(curl -s -m 5 "$B$u" | md5sum); exp=$(md5sum < "$p")
  check "static $u byte-identical ($(wc -c < $p) bytes)" $([ "$got" = "$exp" ] && echo 1) "$got vs $exp"
done
check "config hides nothing secret" $(get "" /config | grep -q devLogin && echo 1)
check "poll without login is 401" $([ "$(curl -s -o /dev/null -w '%{http_code}' $B/poll?room=r1\&since=0)" = 401 ] && echo 1)
A=$(post "" /auth/dev '{"name":"Alice"}' | jget token)
Bt=$(post "" /auth/dev '{"name":"Bob"}' | jget token)
C=$(post "" /auth/dev '{"name":"Carol"}' | jget token)
check "dev login returns tokens" $([ ${#A} -ge 16 ] && [ ${#Bt} -ge 16 ] && [ "$A" != "$Bt" ] && echo 1) "$A $Bt"
check "/me works" $([ "$(get $A /me | jget me.name)" = Alice ] && echo 1)
check "bad room rejected" $(post $A /join '{"room":"bad room!"}' | grep -q '"ok":0' && echo 1)
check "send before join is 403" $(post $A /send '{"room":"r1","kind":"chat","data":"x"}' | grep -q 'join the room' && echo 1)
SA=$(post $A /join '{"room":"r1"}' | jget since)
SB=$(post $Bt /join '{"room":"r1"}' | jget since)
check "Carol joins other room r2" $(post $C /join '{"room":"r2"}' | grep -q '"ok":1' && echo 1)
check "room full for 3rd" $(post $C /join '{"room":"r1"}' | grep -q 'full' && echo 1)
post $C /join '{"room":"r2"}' >/dev/null
check "A sends chat" $(post $A /send '{"room":"r1","kind":"chat","data":"hello from A \u00e9"}' | grep -q '"ok":1' && echo 1)
check "B sends chat" $(post $Bt /send '{"room":"r1","kind":"chat","data":"hi A, B here"}' | grep -q '"ok":1' && echo 1)
PB=$(get $Bt "/poll?room=r1&since=$SB")
check "B receives A's chat" $(echo "$PB" | jget "messages.filter(m=>m.type=='chat').map(m=>m.data).join('|')" | grep -q 'hello from A é' && echo 1) "$PB"
check "B does not receive own chat" $(echo "$PB" | jget "messages.filter(m=>m.data=='hi A, B here').length" | grep -qx 0 && echo 1)
PA=$(get $A "/poll?room=r1&since=$SA")
check "A receives B's join + chat" $(echo "$PA" | jget "messages.map(m=>m.type+':'+m.name).join(',')" | grep -q 'join:Bob,chat:Bob' && echo 1) "$PA"
# Additional stability checks are reported separately so the original total stays 29.
extra_check() { if [ "$2" = "1" ]; then echo "PASS $1"; else echo "FAIL $1 :: $3"; extra_fail=$((extra_fail+1)); fi; }
extra_fail=0
# The browser URI-encodes chat text (BSL turns surrogate pairs into invalid UTF-8), so emoji travel as ASCII.
CHECK_EMOJI=$(post "$A" /send '{"room":"r1","kind":"chat","data":"emoji%20%F0%9F%98%80%20stays%20intact"}')
extra_check "emoji chat send" "$(echo "$CHECK_EMOJI" | grep -q '"ok":1' && echo 1)" "$CHECK_EMOJI"
CHECK_SCRIPT=$(post "$A" /send '{"room":"r1","kind":"chat","data":"<script>alert(1)</script>"}')
extra_check "script-text chat send" "$(echo "$CHECK_SCRIPT" | grep -q '"ok":1' && echo 1)" "$CHECK_SCRIPT"
PSPECIAL=$(get $Bt "/poll?room=r1&since=$SB")
extra_check "emoji chat round-trips" "$(echo "$PSPECIAL" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const o=JSON.parse(d);process.exit(o.messages.some(m=>decodeURIComponent(m.data)==="emoji \u{1f600} stays intact")?0:1)})' && echo 1)" "$PSPECIAL"
extra_check "script text round-trips" "$(echo "$PSPECIAL" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const o=JSON.parse(d);process.exit(o.messages.some(m=>m.data==="<script>alert(1)</script>")?0:1)})' && echo 1)" "$PSPECIAL"
rapid_ok=1
for i in $(seq 1 50); do response=$(get $Bt "/poll?room=r1&since=$SB"); echo "$response" | grep -q '"ok":1' || rapid_ok=0; done
extra_check "50 rapid polls" "$rapid_ok" "one or more polls failed"
idle_start=$(date +%s)
(exec 3<>/dev/tcp/localhost/3001; sleep 3; exec 3>&-) &
idle_pid=$!
wait $idle_pid
idle_elapsed=$(($(date +%s)-idle_start))
idle_status=$(curl -s -m 10 -o /dev/null -w '%{http_code}' "$B/")
extra_check "server survives idle client disconnect" $([ "$idle_status" = 200 ] && echo 1) "HTTP status $idle_status"
echo "INFO idle client blocked server for approximately ${idle_elapsed}s"
# Carol has not polled for >15 s by now, so the server must have dropped her from r2.
PC_IDLE=$(get $C "/poll?room=r2&since=0")
extra_check "idle peer dropped after 15 s" "$(echo "$PC_IDLE" | grep -q 'not in this room' && echo 1)" "$PC_IDLE"
post $C /join '{"room":"r2"}' >/dev/null
# A has also been idle for >15 s (only B polled above), so the server dropped A from r1 too. Rejoin, like the browser would.
post $A /join '{"room":"r1"}' >/dev/null
PC=$(get $C "/poll?room=r2&since=0")
check "Carol (r2) sees no r1 messages" "$([ "$(echo "$PC" | jget "messages.filter(m=>m.room!='r2').length")" = 0 ] && echo 1)" "$PC"
check "Carol cannot poll r1" $(get $C "/poll?room=r1&since=0" | grep -q 'not in this room' && echo 1)
# Duplicate nonce replay
n=dupnonce12345
r1=$(curl -s -X POST -H "X-Nonce: $n" -H "Authorization: Bearer $A" --data-binary "{\"room\":\"r1\",\"kind\":\"chat\",\"data\":\"once\",\"nonce\":\"$n\"}" $B/send)
r2=$(curl -s -X POST -H "X-Nonce: $n" -H "Authorization: Bearer $A" --data-binary "{\"room\":\"r1\",\"kind\":\"chat\",\"data\":\"once\",\"nonce\":\"$n\"}" $B/send)
check "replayed nonce rejected" $(echo "$r2" | grep -q duplicate && echo 1) "$r1 / $r2"
check "nonce mismatch rejected" $(curl -s -m 5 -X POST -H "X-Nonce: abcdefgh1" -H "Authorization: Bearer $A" --data-binary '{"room":"r1","kind":"chat","data":"x","nonce":"zzzzzzzz9"}' $B/send | grep -q 'X-Nonce' && echo 1)
# A signal chunk the size the browser sends
big=$(head -c 900 /dev/zero | tr '\0' 'v')
R900=$(post $A /send "{\"room\":\"r1\",\"kind\":\"signal\",\"data\":{\"id\":\"s1\",\"i\":0,\"n\":1,\"c\":\"$big\"}}")
check "900-char signal chunk accepted" "$(echo "$R900" | grep -q '"ok":1' && echo 1)" "$R900"
# Many messages -> large poll response (> 8 KB) must arrive intact
for i in $(seq 1 12); do post $A /send "{\"room\":\"r1\",\"kind\":\"signal\",\"data\":{\"id\":\"s$i\",\"i\":0,\"n\":1,\"c\":\"$big\"}}" >/dev/null; done
PB2=$(get $Bt "/poll?room=r1&since=$SB")
check "large poll response parses (${#PB2} bytes)" "$([ "$(echo "$PB2" | jget "messages.filter(m=>m.type=='signal').length")" = 13 ] && echo 1)" "${PB2:0:200}"
big5k=$(mktemp); head -c 5000 /dev/zero | tr '\0' 'a' > "$big5k"
check "too-large body is 413" $(curl -s -o /dev/null -w "%{http_code}" -X POST -H "X-Nonce: abcdefgh2" -H "Authorization: Bearer $A" --data-binary @"$big5k" $B/send | grep -q 413 && echo 1)
check "B leaves" $(post $Bt /leave '{"room":"r1"}' | grep -q '"ok":1' && echo 1)
check "A sees B leave" $(get $A "/poll?room=r1&since=0" | jget "messages.filter(m=>m.type=='leave').map(m=>m.name).join()" | grep -q Bob && echo 1)
check "github endpoint explains gap (501)" $([ "$(curl -s -o /dev/null -w '%{http_code}' $B/auth/github)" = 501 ] && echo 1)
check "google without client id is 503" $(post "" /auth/google '{"credential":"a.b.c"}' | grep -q 'client ID' && echo 1)
check "logout kills token" $(post $C /logout '{}' >/dev/null; get $C /me | grep -q 'not signed in' && echo 1)
check "server still alive" $(curl -s -o /dev/null -w '%{http_code}' $B/ | grep -q 200 && echo 1)
echo "RESULT pass=$pass fail=$fail"
echo "EXTRA fail=$extra_fail"
