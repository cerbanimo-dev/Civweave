"""Button edge/hold logic. PTT is a control event; this module captures no audio."""


class Buttons:
    def __init__(self):
        self.a_since = None
        self.b_since = None
        self.ptt = False
        self.b_held = False

    def cancel(self):
        events = ['ptt_stop'] if self.ptt else []
        self.a_since = self.b_since = None
        self.ptt = self.b_held = False
        return events

    def update(self, a_down, b_down, now):
        events = []
        if a_down and self.a_since is None:
            self.a_since = now
        if a_down and not self.ptt and now - self.a_since >= .4:
            self.ptt = True
            events.append('ptt_start')
        if not a_down and self.a_since is not None:
            events.append('ptt_stop' if self.ptt else 'a_tap')
            self.a_since, self.ptt = None, False
        if b_down and self.b_since is None:
            self.b_since = now
        if b_down and not self.b_held and now - self.b_since >= .8:
            self.b_held = True
            events.append('b_hold')
        if not b_down and self.b_since is not None:
            if not self.b_held:
                events.append('b_tap')
            self.b_since, self.b_held = None, False
        return events
