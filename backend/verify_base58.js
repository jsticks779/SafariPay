const base58btc = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const cids = [
    'Qm11111111111111111111111111111111111111111111',
    'Qm22222222222222222222222222222222222222222222',
    'Qm33333333333333333333333333333333333333333333',
    'Qm44444444444444444444444444444444444444444444',
    'QmABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrst1',
    'Qm98765432198765432198765432198765432198765451',
];

console.log('Validating CIDs against base58btc...\n');
let allValid = true;
cids.forEach((cid, i) => {
    let valid = true;
    for (let char of cid) {
        if (!base58btc.includes(char)) {
            console.log(`❌ CID ${i+1}: Contains invalid char '${char}'`);
            valid = false;
            allValid = false;
            break;
        }
    }
    if (valid) {
        console.log(`✅ CID ${i+1}: ${cid} (${cid.length} chars) - VALID`);
    }
});

console.log(allValid && cids.every(c => c.length === 46) ? '\n✅✅✅ All CIDs are valid base58btc AND exactly 46 chars!' : '\n❌ Check failed');
