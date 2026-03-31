import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

async function test() {
    try {
        console.log('Testing Storacha initialization...');
        
        const { create } = await eval('import("@storacha/client")');
        const { Signer } = await eval('import("@ucanto/principal")');
        const { Delegation } = await eval('import("@ucanto/core/delegation")');
        const { CarReader } = await eval('import("@ipld/car")');

        const { parse } = await eval('import("@ucanto/principal/ed25519")');
        
        const agentKey = process.env.W3_AGENT_KEY?.trim();
        if (!agentKey) throw new Error('W3_AGENT_KEY is missing');
        console.log('Agent key found.');

        let principal;
        try {
            console.log('Trying Signer.from(agentKey)...');
            principal = Signer.from(agentKey as any);
        } catch (e: any) {
            console.log('Signer.from failed:', e.message);
            console.log('Trying ed25519.parse(agentKey)...');
            if (agentKey.startsWith('m')) {
                const updatedKey = 'M' + agentKey.substring(1);
                console.log('Trying with M prefix:', updatedKey);
                principal = parse(updatedKey);
            } else {
                principal = parse(agentKey);
            }
        }
        
        const client = await create({ principal });
        console.log('Client created.');

        const proofStr = process.env.W3_PROOF?.trim();
        if (!proofStr) throw new Error('W3_PROOF is missing');
        console.log('Proof string found, length:', proofStr.length);

        const proofBytes = Buffer.from(proofStr, 'base64');
        const car = await CarReader.fromBytes(proofBytes);
        
        const blocks: any[] = [];
        for await (const block of car.blocks()) {
            blocks.push(block);
        }
        
        const delegation = Delegation.importDAG(blocks);
        if (!delegation) throw new Error('Failed to import delegation DAG');
        
        await client.addProof(delegation);
        console.log('Proof added.');

        const spaces = client.spaces();
        console.log('Spaces found:', spaces.map((s: any) => s.name));
        
        const space = spaces.find((s: any) => s.name === 'samwel');
        if (space) {
            console.log('Space "samwel" found:', space.did());
        } else {
            console.log('Space "samwel" not found. Available:', spaces.length);
        }

    } catch (err: any) {
        console.error('Test failed:', err.message);
        if (err.stack) console.error(err.stack);
    }
}

test();
