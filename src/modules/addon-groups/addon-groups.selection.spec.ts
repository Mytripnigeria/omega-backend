import { BadRequestException } from '@nestjs/common';
import { AddOnGroupsService } from './addon-groups.service';

/**
 * "Maximum number of addons the customer can select (0 = unlimited)" — this
 * API's own words, matching the dashboard ("No limit") and the storefront.
 * The rule check compared against 0 as if it were a real cap, so an ordinary
 * group ("choose at least one sauce, as many as you like") could not be saved
 * at all.
 */
describe('add-on group selection rules', () => {
  const service = new AddOnGroupsService(
    {} as never,
    {} as never,
    {} as never,
  );
  // The check is private; it is the rule under test, not the plumbing.
  const validate = (min: number | null, max: number | null, addons = 3) =>
    (service as unknown as {
      validateSelection: (a: unknown, b: unknown, c: number) => void;
    }).validateSelection(min, max, addons);

  it('accepts a required group with no maximum', () => {
    expect(() => validate(1, 0)).not.toThrow();
  });

  it('accepts a group asking for several with no maximum', () => {
    expect(() => validate(2, 0)).not.toThrow();
  });

  it('accepts a blank maximum', () => {
    expect(() => validate(1, null)).not.toThrow();
  });

  it('still refuses a minimum above a real maximum', () => {
    expect(() => validate(3, 2)).toThrow(BadRequestException);
  });

  it('still refuses a maximum larger than the group', () => {
    expect(() => validate(0, 5, 3)).toThrow(BadRequestException);
  });

  it('does not treat no-limit as larger than the group', () => {
    expect(() => validate(0, 0, 3)).not.toThrow();
  });

  it('still refuses a negative minimum', () => {
    expect(() => validate(-1, 3)).toThrow(BadRequestException);
  });
});
