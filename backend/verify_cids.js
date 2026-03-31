const cids = [
    'QmPK1SVTm9uBrFZruMcFEwra8DBE4wTnRzrNxQi8RKv6P1',
    'QmQGXgShkuNRCgR1H64M4V3VfYvQXx4GfENkXzVEPzB6v1',
    'QmXArB7aYuY69pKM38XfNLVgcUHJKNegaDXfKN4qiyGpG1',
    'QmZvjhCGmEVs9p4yFFKqUeBndZqQgESrpFt1kc6qKpZvr1',
    'QmcFfg1g8Dn3xc4yFh4g5H6i7J8k9L0m1N2o3P4q5R6s7t',
    'QmdB2CjEZBMWtGaQeqBMNxGC5JKhNvSKGEStJLy7gJrRf1',
];

let allValid = true;
cids.forEach((cid, i) => {
    const len = cid.length;
    const status = len === 46 ? '✓' : '✗';
    console.log(`CID ${i+1}: ${cid} = ${len} chars ${status}`);
    if (len !== 46) allValid = false;
});

console.log(allValid ? '\n✅ All CIDs are 46 characters!' : '\n❌ ERROR: Not all CIDs are 46 chars');
