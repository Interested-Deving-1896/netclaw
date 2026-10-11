#!/usr/bin/env python3
"""Bounded local measurement of explicitly selected context; no provider calls."""
import json
import os
from pathlib import Path
import sys

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'src'))
from netclaw_tokens.gcf_serializer import serialize_response

def review(content):
    if not isinstance(content,str) or len(content.encode())>1024*1024:
        raise ValueError('Select at most 1 MiB of retained text')
    try:data=json.loads(content)
    except ValueError:data=content
    source=json.dumps(data,indent=2,default=str)
    result=serialize_response(data,use_session=False,use_delta=False)
    encoded=result['encoded_data']
    return {'measurement':{'selectedCharacters':len(content),'selectedUtf8Bytes':len(content.encode()),
            'jsonCharacters':len(source),'jsonUtf8Bytes':len(source.encode()),'encodedCharacters':len(encoded),'encodedUtf8Bytes':len(encoded.encode())},
            'estimates':{key:result[key] for key in ('json_token_count','gcf_token_count','savings_tokens','savings_pct')},
            'estimateMethod':'floor(Unicode characters / 4), minimum 1; not a model tokenizer or billed usage',
            'analysisSettings':{'mode':os.environ.get('NETCLAW_GCF_MODE','full'),'tabularFormat':os.environ.get('NETCLAW_TABULAR_FORMAT','gcf'),'session':False,'delta':False},
            'profile':result['profile_used'],'fallbackUsed':result['fallback_used'],'providerUsage':None,
            'scope':'Local analysis of explicitly selected retained context; no session/delta state, runtime serialization change, workspace ingest or provider request.'}

if __name__=='__main__':
    raw=sys.stdin.buffer.read(6*1024*1024+65536+1)
    if len(raw)>6*1024*1024+65536:raise SystemExit(2)
    value=json.loads(raw)
    if not isinstance(value,dict) or set(value)!={'content'}:raise SystemExit(2)
    print(json.dumps(review(value['content']),allow_nan=False))
