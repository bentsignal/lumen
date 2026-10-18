"""Policy durability, ownership, config preservation, and API authentication."""
import copy
import json
from pathlib import Path
import sys
import tempfile
import io
import threading
import unittest
from unittest.mock import Mock
sys.path.insert(0, str(Path(__file__).parents[1]))
import policy


class PolicyTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.config = json.loads((Path(__file__).parents[1] / 'config/hyperhdr.example.json').read_text())
        self.stream = []
        self.commands = []
        self.enabled = False
        self.fail = False
        self.cfg = {'device_id': 'test-tv', 'bridge_id': 'test-bridge', 'area': 'area', 'auth_id': 'ours'}
        self.restore = Mock(return_value=True)
        self.snapshot = Mock()
        self.controller = self.create()
        self.controller.power(True)

    def create(self, boot='boot-1'):
        return policy.Controller(self.folder.name, self.cfg, self.api, self.engine, self.snapshot, self.restore, boot)

    def api(self, path, method='GET', data=None):
        if method == 'PUT':
            self.stream = []
            return []
        return copy.deepcopy(self.stream)

    def engine(self, command):
        self.commands.append(copy.deepcopy(command))
        if self.fail:
            raise RuntimeError('engine offline')
        if command['command'] == 'config':
            if command['subcommand'] == 'setconfig':
                self.config = command['config']
            return {'success': True, 'info': copy.deepcopy(self.config)}
        if command['command'] == 'componentstate':
            self.enabled = command['componentstate']['state']
        return {'success': True, 'info': {'priorities': [{'priority': 150, 'active': True}], 'components': [{'name': 'LEDDEVICE', 'enabled': self.enabled}]}}

    def ours(self):
        self.stream = [{'id': 'area', 'status': 'active', 'active_streamer': {'rid': 'ours'}}]

    def test_off_survives_engine_failure_and_helper_restart(self):
        self.fail = True
        with self.assertRaises(RuntimeError):
            self.controller.policy({'mode': 'off'})
        self.fail = False
        restored = self.create()
        restored.power(True)
        restored.tick()
        self.assertEqual(restored.state['mode'], 'off')
        self.assertFalse(self.enabled)
        self.assertFalse(restored.wants_sync())

    def test_pause_survives_helper_restart_and_resets_only_at_next_power_on(self):
        self.controller.policy({'paused': True})
        restarted = self.create()
        restarted.power(True)
        self.assertTrue(restarted.state['paused'])
        restarted.power(False)
        restarted.power(True)
        self.assertFalse(restarted.state['paused'])
        restarted.policy({'paused': True})
        self.assertFalse(self.create('new-cold-boot').state['paused'])

    def test_handoff_stops_and_restores_once_even_after_restart(self):
        self.ours()
        result = self.controller.handoff()
        self.assertTrue(result['restored'])
        self.assertTrue(result['paused'])
        self.restore.assert_called_once()
        restarted = self.create()
        restarted.power(True)
        restarted.tick()
        self.restore.assert_called_once()  # No delayed restore over the user's new scene.
        self.assertFalse(self.config['general']['disableLedsStartup'] is False)

    def test_another_apps_stream_is_never_started_stopped_or_restored(self):
        self.stream = [{'id': 'other-area', 'status': 'active', 'active_streamer': {'rid': 'other'}}]
        self.controller.tick()
        self.assertFalse(self.enabled)
        self.restore.assert_not_called()
        self.snapshot.assert_not_called()

    def test_restart_completes_interrupted_restore_before_starting_sync(self):
        self.ours()
        self.controller.tick()
        self.stream = []
        restarted = self.create()
        restarted.power(True)
        restarted.tick()
        self.restore.assert_called_once()
        self.assertFalse(self.enabled)

    def test_failed_restoration_never_reports_handoff_ready(self):
        self.ours()
        self.restore.return_value = False
        with self.assertRaises(RuntimeError):
            self.controller.handoff()
        self.assertTrue(self.create().state['restore_pending'])

    def test_full_configuration_preserved_and_rollback_written(self):
        self.config['unknownFutureSetting'] = {'keep': 'exact'}
        original = copy.deepcopy(self.config)
        self.controller.tune({'softness': 300})
        self.assertEqual(self.config['unknownFutureSetting'], original['unknownFutureSetting'])
        self.assertEqual(self.config['device'], original['device'])
        self.assertEqual(self.config['leds'], original['leds'])
        self.assertEqual(self.config['smoothing']['updateFrequency'], 50)
        self.assertEqual(self.config['smoothing']['time_ms'], 300)
        self.assertTrue(Path(self.folder.name, 'config-rollback.json').exists())
        self.assertEqual(original['smoothing']['time_ms'], 150)

    def test_invalid_values_do_not_write_and_balanced_retains_approved_baseline(self):
        for patch in [{'softness': 0}, {'intensity': float('nan')}, {'brightness': True}, {'device': {}}, {'preset': 'adaptive'}]:
            with self.assertRaises(ValueError):
                policy.merged_tuning(self.config, patch)
        result = policy.merged_tuning(self.config, {'preset': 'balanced'})
        self.assertEqual(result['smoothing']['time_ms'], 150)
        self.assertEqual(result['smoothing']['updateFrequency'], 50)
        self.assertEqual(self.commands, [])

    def test_bearer_authentication_rejects_missing_or_wrong_credentials(self):
        token = 'test-token-with-sufficient-length-1234'
        self.assertTrue(policy.authorized('Bearer ' + token, token))
        for header in [None, '', token, 'Bearer wrong', 'Basic ' + token]:
            self.assertFalse(policy.authorized(header, token))

    def test_slow_stream_start_is_not_cancelled_by_the_next_guard_tick(self):
        self.controller.tick()
        self.assertTrue(self.enabled)
        self.controller.tick()
        self.assertTrue(self.enabled)
        self.restore.assert_not_called()

    def test_other_app_takeover_cancels_our_old_restore_obligation(self):
        self.ours()
        self.controller.tick()
        self.stream = [{'id': 'area', 'status': 'active', 'active_streamer': {'rid': 'other'}}]
        self.controller.tick()
        self.stream = []
        restarted = self.create()
        restarted.power(True)
        restarted.tick()
        self.restore.assert_not_called()
        self.snapshot.assert_called()

    def test_serialized_tuning_preserves_both_independent_changes(self):
        errors = []
        def tune(patch):
            try:
                self.controller.tune(patch)
            except Exception as error:
                errors.append(error)
        threads = [threading.Thread(target=tune, args=(patch,)) for patch in [{'brightness': 50}, {'softness': 300}]]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(5)
            self.assertFalse(thread.is_alive())
        self.assertEqual(errors, [])
        self.assertEqual(self.config['device']['brightnessFactor'], .5)
        self.assertEqual(self.config['smoothing']['time_ms'], 300)

    def test_corrupt_saved_policy_does_not_reset_to_auto(self):
        Path(self.folder.name, 'policy.json').write_text('{"mode":"off","paused":"invalid"}')
        with self.assertRaises(ValueError):
            self.create()

    def test_engine_login_and_command_share_socket_and_ignore_notifications(self):
        connection = Mock()
        connection.makefile.return_value = io.BytesIO(b'{"tan":900,"success":true}\n{"tan":0,"success":true}\n{"tan":901,"success":true,"info":{}}\n')
        connect = Mock(return_value=connection)
        policy.engine_request({'command': 'serverinfo'}, 'test-password', connect)
        commands = [json.loads(call.args[0]) for call in connection.sendall.call_args_list]
        self.assertEqual([command['command'] for command in commands], ['authorize', 'serverinfo'])
        connection.close.assert_called_once()

    def test_failed_engine_auth_never_sends_the_mutating_command(self):
        connection = Mock()
        connection.makefile.return_value = io.BytesIO(b'{"tan":900,"success":false}\n')
        with self.assertRaises(RuntimeError):
            policy.engine_request({'command': 'config', 'subcommand': 'setconfig'}, 'wrong', Mock(return_value=connection))
        self.assertEqual(connection.sendall.call_count, 1)


if __name__ == '__main__':
    unittest.main()
