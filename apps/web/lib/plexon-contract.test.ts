import { describe, expect, it } from 'vitest';

import {
  getPlexonContractHeaders,
  PLEXON_CONTRACT_VERSION_HEADER,
  PLEXON_FEDERATION_CONTRACT_VERSION,
  PLEXON_SERVICE_SECRET_HEADER,
} from './plexon-contract';

describe('AUDION PLEXON federation contract helpers', () => {
  it('returns the shared contract version header', () => {
    expect(getPlexonContractHeaders('secret-1')).toEqual({
      [PLEXON_CONTRACT_VERSION_HEADER]: PLEXON_FEDERATION_CONTRACT_VERSION,
      [PLEXON_SERVICE_SECRET_HEADER]: 'secret-1',
    });
  });
});
