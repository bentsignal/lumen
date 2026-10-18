"""Regression coverage for Hue writable state, ownership and restart races."""
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
import sys
from unittest.mock import patch

CONFIG = {'host': '192.0.2.20', 'username': 'test-key', 'auth_id': 'our-app', 'area': 'area', 'lights': ['strip']}
sys.path.insert(0, str(Path(__file__).parents[1]))
spec = importlib.util.spec_from_file_location('guard', Path(__file__).parents[1] / 'guard.py')
guard = importlib.util.module_from_spec(spec)
with patch('builtins.open', return_value=io.StringIO(json.dumps(CONFIG))):
    spec.loader.exec_module(guard)


class RestorationTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.base = patch.object(guard, 'BASE', self.folder.name)
        self.base.start()
        self.addCleanup(self.base.stop)
        self.state = {'strip': {'on': {'on': True}, 'dimming': {'brightness': 37}}}
        Path(self.folder.name, 'normal-state.json').write_text(json.dumps(self.state))

    def test_empty_gradient_uses_writable_xy_without_readonly_fields(self):
        light = {'on': {'on': True}, 'dimming': {'brightness': 37, 'min_dim_level': 0.2}, 'gradient': {'points': [], 'points_capable': 7}, 'color': {'xy': {'x': .3, 'y': .4}, 'gamut_type': 'C'}}
        self.assertEqual(guard.writable(light), {'on': {'on': True}, 'dimming': {'brightness': 37}, 'color': {'xy': {'x': .3, 'y': .4}}})

    def test_valid_gradient_preserves_only_points_and_mode(self):
        points = [{'color': {'xy': {'x': .3, 'y': .4}}}, {'color': {'xy': {'x': .4, 'y': .3}}}]
        light = {'on': {'on': True}, 'dimming': {'brightness': 37}, 'gradient': {'points': points, 'mode': 'interpolated_palette', 'points_capable': 7, 'pixel_count': 20}}
        self.assertEqual(guard.writable(light)['gradient'], {'points': points, 'mode': 'interpolated_palette'})

    def test_restore_does_not_stop_a_newly_restarted_stream(self):
        with patch.object(guard, 'api', return_value=[{'status': 'active', 'active_streamer': {'rid': 'our-app'}}]) as api:
            guard.restore()
        api.assert_called_once_with('entertainment_configuration/area')

    def test_poweroff_never_steals_another_apps_stream(self):
        with patch.object(guard, 'api', return_value=[{'status': 'active', 'active_streamer': {'rid': 'another-app'}}]) as api:
            guard.restore(stop_stream=True)
        api.assert_called_once_with('entertainment_configuration/area')

    def test_poweroff_stops_our_stream_before_restoring(self):
        with patch.object(guard, 'api', side_effect=[[{'status': 'active', 'active_streamer': {'rid': 'our-app'}}], [], [{'status': 'inactive'}], []]) as api:
            guard.restore(stop_stream=True)
        self.assertEqual(api.call_args_list[1].args, ('entertainment_configuration/area', 'PUT', {'action': 'stop'}))
        self.assertEqual(api.call_args_list[3].args, ('light/strip', 'PUT', self.state['strip']))

    def test_new_stream_after_stop_blocks_restoration(self):
        with patch.object(guard, 'api', side_effect=[[{'status': 'active', 'active_streamer': {'rid': 'our-app'}}], [], [{'status': 'active', 'active_streamer': {'rid': 'other'}}]]) as api:
            self.assertFalse(guard.restore(stop_stream=True))
        self.assertFalse(any(call.args[0] == 'light/strip' for call in api.call_args_list))


if __name__ == '__main__':
    unittest.main()
